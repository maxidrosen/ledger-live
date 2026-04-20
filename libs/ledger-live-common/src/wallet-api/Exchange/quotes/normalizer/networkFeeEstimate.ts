import BigNumber from "bignumber.js";

import type {
  QuoteApprovalNetworkFee,
  QuoteEstimatedNetworkFee,
} from "@ledgerhq/wallet-api-exchange-module";

import type { RawQuote } from "../service/types";
import { isGasLess } from "./quoteHelpers";

/**
 * EVM-approximation: extra gas limit a token-approval transaction consumes
 * on top of the swap itself. Mirrors
 * `swap-live-app/apps/live-app/src/utils/calculateCustomNetworkFee.ts:10`.
 */
export const APPROVAL_GAS_LIMIT = 60_000;

/**
 * Per-chain hardcoded fee overrides (in display / non-atomic units of the
 * fee currency). These replace both the swap-side and approval-side gas
 * math for chains whose bridges don't expose a useful `gasPrice` /
 * `maxFeePerGas` (so the normal EVM fee formula doesn't apply).
 *
 * Solana: SPL token swaps include the 0.002 SOL rent-exemption for the
 * receiver's associated token account plus base tx fees. 0.003 SOL
 * covers our worst case across send flows.
 * Mirror of the hack in
 * `swap-live-app/apps/live-app/src/hooks/useGetFees.ts:102-104`.
 */
const CHAIN_FEE_OVERRIDES_NON_ATOMIC: Record<string, BigNumber> = {
  solana: new BigNumber("0.003"),
};

/**
 * Single-call, default-strategy fee estimation context for a `getQuotes`
 * invocation. Built once by the wallet-side pipeline from the fee-paying
 * (parent) account's bridge, then passed into every per-quote
 * {@link computeFeeEstimate} call — differs only by each quote's own
 * `gasLimit`, so the async bridge call does not need to repeat per quote.
 *
 * All monetary fields are expressed in atomic units of the fee currency
 * (e.g. wei for ethereum-family chains, lamports for solana) so that the
 * downstream {@link QuoteEstimatedNetworkFee} / {@link QuoteApprovalNetworkFee}
 * payloads preserve full precision.
 */
export type NetworkFeeContext = {
  /** EIP-1559 fee per gas (atomic units). Preferred over `gasPrice` when non-zero. */
  maxFeePerGas?: BigNumber;
  /** Legacy gas price (atomic units). Used when `maxFeePerGas` is absent or zero. */
  gasPrice?: BigNumber;
  /** Default gas limit when the quote itself omits `networkFees.gasLimit`. */
  defaultGasLimit?: string;
  /**
   * Bridge-reported total fee estimate (atomic units). Used as the
   * fallback when neither `maxFeePerGas` nor `gasPrice` is available —
   * e.g. non-EVM chains — to populate `estimatedNetworkFee` for
   * non-gasless quotes, matching the legacy `fees.estimatedFees`
   * fallback.
   */
  estimatedFeesAtomic: BigNumber;
  /** Spendable balance on the fee-paying (parent) account, atomic units. */
  balanceAtomic: BigNumber;
  /** Currency id stamped onto emitted fee fields (e.g. "ethereum", "solana"). */
  feeCurrencyId: string;
  /** Magnitude of the fee currency; used to convert chain overrides to atomic. */
  feeCurrencyMagnitude: number;
  /**
   * Fee-paying main-account currency id; used to look up per-chain
   * overrides (e.g. the Solana 0.003 SOL hack). Normally equals
   * `feeCurrencyId`, but kept separate so the override table can evolve
   * independently.
   */
  mainAccountCurrencyId: string;
};

export type FeeEstimate = {
  estimatedNetworkFee?: QuoteEstimatedNetworkFee;
  approvalNetworkFee?: QuoteApprovalNetworkFee;
  notEnoughBalance: boolean;
};

/**
 * Compute the wallet-side network-fee estimate for a single raw quote.
 *
 * Emits up to two fields on the resulting {@link FeeEstimate}:
 *   - `estimatedNetworkFee`: base swap-gas cost, always in atomic units.
 *     Undefined when zero (gasless RFQ quotes, or override-chain gasless).
 *   - `approvalNetworkFee`: extra cost of the pre-swap ERC-20 approval
 *     transaction (`APPROVAL_GAS_LIMIT * gasPrice`). Undefined when no
 *     approval is required, or when the chain has a per-chain override.
 *
 * Parity with legacy
 * `swap-live-app/apps/live-app/src/utils/calculateCustomNetworkFee.ts`:
 *   - `estimatedNetworkFee + approvalNetworkFee === calculateCustomNetworkFee(quote, fees)`
 *   - `approvalNetworkFee === calculateCustomNetworkFee(quote, fees, onlyApproval=true)`
 * (all values compared in atomic units).
 */
export function computeFeeEstimate(quote: RawQuote, context: NetworkFeeContext): FeeEstimate {
  const gasLess = isGasLess(quote);
  const needsApproval = quote.tokenAllowanceData?.isApproved === false;

  const override = CHAIN_FEE_OVERRIDES_NON_ATOMIC[context.mainAccountCurrencyId];
  if (override !== undefined) {
    return computeOverrideFeeEstimate(quote, context, override, gasLess);
  }

  const effectiveGasPrice = pickGasPrice(context);

  // Legacy behavior: for gasless quotes the swap itself has no base gas
  // cost (the whole point of RFQ), so `baseGasLimit` drops to 0. Only the
  // approval-gas portion remains.
  const baseGasLimit = gasLess
    ? new BigNumber(0)
    : new BigNumber(quote.networkFees.gasLimit ?? context.defaultGasLimit ?? 0);
  const approvalGasLimit = needsApproval ? new BigNumber(APPROVAL_GAS_LIMIT) : new BigNumber(0);

  let baseFeeAtomic: BigNumber;
  let approvalFeeAtomic: BigNumber;

  if (effectiveGasPrice && effectiveGasPrice.gt(0)) {
    baseFeeAtomic = baseGasLimit.multipliedBy(effectiveGasPrice);
    approvalFeeAtomic = approvalGasLimit.multipliedBy(effectiveGasPrice);
  } else {
    // No gas config (non-EVM chain without a chain override). Fall back
    // to the bridge-reported estimate for the base, matching legacy's
    // `fees.estimatedFees` fallback. Approval gas is unknowable without a
    // price, so legacy returns 0 for it — we follow suit.
    baseFeeAtomic = gasLess ? new BigNumber(0) : context.estimatedFeesAtomic;
    approvalFeeAtomic = new BigNumber(0);
  }

  const totalAtomic = baseFeeAtomic.plus(approvalFeeAtomic);

  return {
    estimatedNetworkFee: toAtomicFeeField(baseFeeAtomic, context.feeCurrencyId),
    approvalNetworkFee: toAtomicFeeField(approvalFeeAtomic, context.feeCurrencyId),
    notEnoughBalance: shouldCheckBalance(quote) && context.balanceAtomic.lt(totalAtomic),
  };
}

/**
 * Per-chain override branch. Legacy treats overridden chains as paying
 * exactly the hardcoded amount for a real swap (`onlyApproval=false`) and
 * nothing for an approval-only call (`onlyApproval=true`); the per-quote
 * `needsApproval` flag does not influence the override amount because the
 * fallback path that produces it ignores `APPROVAL_GAS_LIMIT` when no
 * gas price is available. Consequently we emit only `estimatedNetworkFee`
 * on override chains.
 */
function computeOverrideFeeEstimate(
  quote: RawQuote,
  context: NetworkFeeContext,
  overrideNonAtomic: BigNumber,
  gasLess: boolean,
): FeeEstimate {
  const overrideAtomic = overrideNonAtomic.shiftedBy(context.feeCurrencyMagnitude);
  const baseFeeAtomic = gasLess ? new BigNumber(0) : overrideAtomic;

  return {
    estimatedNetworkFee: toAtomicFeeField(baseFeeAtomic, context.feeCurrencyId),
    approvalNetworkFee: undefined,
    notEnoughBalance: shouldCheckBalance(quote) && context.balanceAtomic.lt(baseFeeAtomic),
  };
}

function pickGasPrice(context: NetworkFeeContext): BigNumber | undefined {
  if (context.maxFeePerGas && context.maxFeePerGas.gt(0)) {
    return context.maxFeePerGas;
  }
  if (context.gasPrice && context.gasPrice.gt(0)) {
    return context.gasPrice;
  }
  return undefined;
}

/**
 * Legacy gate (`quoteErrorChecker.ts:32-36`): skip the balance check when
 * the aggregator reports zero network fees AND the provider doesn't
 * require a token approval, because a pure RFQ swap of an already-approved
 * token has no on-chain cost.
 */
function shouldCheckBalance(quote: RawQuote): boolean {
  return (quote.networkFees.value ?? 0) !== 0 || quote.tags.isTokenApprovalRequired === true;
}

function toAtomicFeeField(
  amount: BigNumber,
  currencyId: string,
): QuoteEstimatedNetworkFee | undefined {
  if (!amount.gt(0)) {
    return undefined;
  }
  return { amount: amount.toFixed(0), currencyId };
}
