import { log } from "@ledgerhq/logs";
import type { Account, AccountLike } from "@ledgerhq/types-live";
import BigNumber from "bignumber.js";
import { firstValueFrom, reduce } from "rxjs";

import { getMainAccount, getParentAccount } from "@ledgerhq/ledger-wallet-framework/account/index";

import { getAccountBridge } from "../../../bridge";
import { getAbandonSeedAddress } from "../../../currencies";
import { getAccountIdFromWalletAccountId } from "../../converters";
import type { NetworkFeeContext } from "./normalizer/networkFeeEstimate";

/** SegWit-compatible abandon-seed address for bitcoin fee estimation. */
const BITCOIN_SEGWIT_ABANDON_SEED = "bc1qed3mqr92zvq2s782aqkyx785u23723w02qfrgs";

export type FetchNetworkFeeContextArgs = {
  accounts: AccountLike[];
  /** Wallet-API-formatted account id — the same value the caller passes as `QuotesInput.sendAccountId`. */
  fromAccountId: string;
  /** Display-unit (non-atomic) send amount as a decimal string, mirroring `QuotesInput.amount`. */
  amountFrom: string;
};

/**
 * One-shot async fee-estimation fetch for a `getQuotes` invocation.
 *
 * Returns a {@link NetworkFeeContext} describing the fee-paying account's
 * default-strategy gas parameters + current spendable balance, or `null`
 * when estimation fails for any reason (account not found, bridge error,
 * unsupported chain). Callers treat `null` as "no fee estimate available"
 * — every downstream quote's `estimatedNetworkFee` / `approvalNetworkFee`
 * stays undefined and `error: notEnoughBalanceForFees` is not emitted.
 *
 * Design notes:
 *   - Called exactly once per `getQuotes` invocation, not per quote. All
 *     quotes in a single response share the same fee-paying account, so
 *     only the per-quote `gasLimit` differs — and that's applied
 *     synchronously by {@link computeFeeEstimate} downstream.
 *   - Hardcodes `feesStrategy: "medium"` per the product principle that
 *     default-strategy fees are authoritative for wallet-side quote
 *     emission; user-selected custom fees are a UI concern that lives
 *     outside this pipeline.
 *   - Mirrors
 *     `ledger-live-mobile/src/screens/Swap/LiveApp/customHandlers/getFee.ts`
 *     one-to-one (bitcoin sync-first branch, 90%-of-amount / 10%-of-balance
 *     trick) so that the wallet-side estimate lines up with what the
 *     legacy `swapModule.getFee` RPC round-trip produces today.
 */
export async function fetchNetworkFeeContext(
  args: FetchNetworkFeeContextArgs,
): Promise<NetworkFeeContext | null> {
  try {
    const realAccountId = getAccountIdFromWalletAccountId(args.fromAccountId);
    if (!realAccountId) {
      return null;
    }

    const fromAccount = args.accounts.find(acc => acc.id === realAccountId);
    if (!fromAccount) {
      return null;
    }

    const fromParentAccount = getParentAccount(fromAccount, args.accounts);
    let mainAccount = getMainAccount(fromAccount, fromParentAccount);
    const bridge = getAccountBridge(fromAccount, fromParentAccount);

    // Bitcoin bridges require a fresh sync before `prepareTransaction` can
    // compute fees, because UTXO selection depends on currently-confirmed
    // inputs. EVM / Solana bridges don't need this.
    if (mainAccount.currency.id === "bitcoin") {
      try {
        mainAccount = await firstValueFrom(
          bridge
            .sync(mainAccount, { paginationConfig: {} })
            .pipe(reduce((a: Account, f: (acc: Account) => Account) => f(a), mainAccount)),
        );
      } catch (e) {
        log("swap", "fetchNetworkFeeContext: btc sync failed", e);
      }
    }

    const amountInAtomicUnits = resolveFeeEstimationAmount({
      fromAccount,
      mainAccount,
      displayAmount: args.amountFrom,
    });

    const subAccountId = fromAccount.type !== "Account" ? fromAccount.id : undefined;
    const recipient =
      mainAccount.currency.id === "bitcoin"
        ? BITCOIN_SEGWIT_ABANDON_SEED
        : getAbandonSeedAddress(mainAccount.currency.id);

    const preparedTx = await bridge.prepareTransaction(mainAccount, {
      ...bridge.createTransaction(mainAccount),
      subAccountId,
      recipient,
      amount: amountInAtomicUnits,
      feesStrategy: "medium",
    } as Parameters<typeof bridge.prepareTransaction>[1]);

    const status = await bridge.getTransactionStatus(mainAccount, preparedTx);

    return buildContext(mainAccount, preparedTx, status);
  } catch (e) {
    log("swap", "fetchNetworkFeeContext: bridge failure", e);
    return null;
  }
}

/**
 * 90%-of-amount / 10%-of-balance hack, mirroring
 * `swap-live-app/apps/live-app/src/hooks/useGetFees.ts:31-45`. The
 * aggregator-reported send amount occasionally exceeds the spendable
 * balance (testing, rounding, dust), which makes bridges reject
 * `prepareTransaction` with `InsufficientBalance` before they ever quote
 * a fee. Shrinking the amount keeps the bridge happy without materially
 * changing the fee estimate.
 */
function resolveFeeEstimationAmount(input: {
  fromAccount: AccountLike;
  mainAccount: Account;
  displayAmount: string;
}): BigNumber {
  const displayAmount = new BigNumber(input.displayAmount);
  const magnitude = magnitudeOf(input.fromAccount);

  if (displayAmount.isNaN() || displayAmount.isZero()) {
    return input.fromAccount.spendableBalance.multipliedBy(0.1).integerValue(BigNumber.ROUND_DOWN);
  }

  return displayAmount.shiftedBy(magnitude).multipliedBy(0.9).integerValue(BigNumber.ROUND_DOWN);
}

function magnitudeOf(account: AccountLike): number {
  if (account.type === "TokenAccount") {
    return account.token.units[0]?.magnitude ?? 0;
  }
  return account.currency.units[0]?.magnitude ?? 0;
}

/**
 * Extract gas parameters from the prepared transaction + transaction
 * status. Reads EVM-family `maxFeePerGas` / `gasPrice` when present;
 * otherwise leaves them undefined so the downstream math falls back to
 * `status.estimatedFees` (or a per-chain override for Solana).
 */
function buildContext(
  mainAccount: Account,
  // Bridge transaction and status types vary per coin family; we read
  // only well-known optional EVM fields via `Record` access.
  preparedTx: Record<string, unknown>,
  status: { estimatedFees: BigNumber },
): NetworkFeeContext {
  const feeCurrency = mainAccount.currency;
  const feeCurrencyMagnitude = feeCurrency.units[0]?.magnitude ?? 0;

  const maxFeePerGas = coerceBigNumber(preparedTx.maxFeePerGas);
  const gasPrice = coerceBigNumber(preparedTx.gasPrice);
  const defaultGasLimit = coerceString(preparedTx.gasLimit ?? preparedTx.userGasLimit);

  return {
    maxFeePerGas,
    gasPrice,
    defaultGasLimit,
    estimatedFeesAtomic: status.estimatedFees ?? new BigNumber(0),
    balanceAtomic: mainAccount.spendableBalance,
    feeCurrencyId: feeCurrency.id,
    feeCurrencyMagnitude,
    mainAccountCurrencyId: mainAccount.currency.id,
  };
}

function coerceBigNumber(v: unknown): BigNumber | undefined {
  if (v == null) return undefined;
  if (BigNumber.isBigNumber(v)) return v;
  if (typeof v === "string" || typeof v === "number") {
    const bn = new BigNumber(v);
    return bn.isNaN() ? undefined : bn;
  }
  return undefined;
}

function coerceString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (BigNumber.isBigNumber(v)) return v.toFixed(0);
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}
