import { RawTransaction } from "@ledgerhq/wallet-api-core";
import BigNumber from "bignumber.js";

export enum ExchangeType {
  SWAP = 0x00,
  SELL = 0x01,
  FUND = 0x02,
}

export type ExchangeStartParams =
  | ExchangeStartFundParams
  | ExchangeStartSellParams
  | ExchangeStartSwapParams;

export type ExchangeStartFundParams = {
  exchangeType: "FUND";
  provider: string;
  fromAccountId: string;
};

export type ExchangeStartSellParams = {
  exchangeType: "SELL";
  provider: string;
  fromAccountId: string;
};

export type ExchangeStartSwapParams = {
  exchangeType: "SWAP";
  provider: string;
  fromAccountId: string;
  toAccountId: string;
  tokenCurrency?: string;
};

export type ExchangeSwapParams = ExchangeStartSwapParams & {
  fromAmount: string;
  fromAmountAtomic: BigNumber;
  quoteId?: string;
  toNewTokenId?: string;
  feeStrategy: "slow" | "medium" | "fast" | "custom";
  customFeeConfig?: {
    [key: string]: BigNumber;
  };
  swapAppVersion?: string;
  sponsored?: boolean;
  isEmbedded?: boolean;
  correlationId?: string;
};

export type ExchangeStartResult = {
  transactionId: string;
  device?: { deviceId?: string; modelId?: string };
};

export type ExchangeFundResult = {
  transactionId: string;
  device?: { deviceId?: string; modelId?: string };
};

export type ExchangeCompleteBaseParams = {
  provider: string;
  fromAccountId: string;
  rawTransaction: RawTransaction;
  hexBinaryPayload: string;
  hexSignature: string;
  feeStrategy: "slow" | "medium" | "fast" | "custom";
  tokenCurrency?: string;
};

export type ExchangeCompleteFundParams = ExchangeCompleteBaseParams & {
  exchangeType: "FUND";
};

export type ExchangeCompleteSellParams = ExchangeCompleteBaseParams & {
  exchangeType: "SELL";
};

export type ExchangeCompleteSwapParams = ExchangeCompleteBaseParams & {
  exchangeType: "SWAP";
  toAccountId: string;
  swapId: string;
};

export type ExchangeCompleteParams =
  | ExchangeCompleteFundParams
  | ExchangeCompleteSellParams
  | ExchangeCompleteSwapParams;

export type ExchangeCompleteResult = {
  transactionHash: string;
};

export type SwapResult = {
  operationHash: string;
  swapId: string;
};

export type SwapLiveError = {
  name: string;
  message: string;
  type?: string;
  cause: {
    message?: string;
    swapCode?: string;
    response?: {
      data?: {
        error?: { messageKey?: string; message?: string };
      };
    };
  };
};

// --- Swap quotes (`custom.exchange.getQuotes` wire) — keep internal HTTP shapes in ledger-live-common only ---

export type UniswapOrderType = "classic" | "uniswapxv2" | "all";

export type QuotesInput = {
  amount: string;
  sendAccountId: string;
  receiveAccountId: string;
  sendAddress: string;
  receiveAddress: string;
  sendCurrencyId: string;
  receiveCurrencyId: string;
  counterValueCurrency: string;
  networkFeesCurrencyId?: string;
  slippage?: number;
  uniswapOrderType?: UniswapOrderType;
};

export type GetQuotesArgs = {
  providers: string[];
  data: QuotesInput;
  headers?: Array<[string, string]>;
  signal?: AbortSignal;
};

export type GetQuotesWireArgs = Omit<GetQuotesArgs, "signal">;

export type TradeMethod = "fixed" | "float";

export type ProviderTypes = "DEX" | "CEX";

/**
 * Non-fatal signals attached to a quote. Consumers decide whether to surface,
 * hide, or filter based on the `code` discriminant. Declared as a discriminated
 * union with a single member for now so new variants can be added additively
 * without reshaping call sites.
 *
 * - `unrealisticQuote`: expected fiat output exceeds fiat input by `gainPercent`.
 *   Consumers that can reach a countervalues source use this to hide or badge
 *   the row.
 */
export type QuoteWarning = { code: "unrealisticQuote"; gainPercent: number };

export type QuoteError = "notEnoughBalanceForFees";

export type ProviderDetails = {
  name: string;
  type: ProviderTypes;
  url?: string;
  isUniswapX: boolean;
  requiresKYC: boolean;
  continuesInProviderLiveApp: boolean;
};

export type QuoteNetworkFees = {
  currencyId: string;
  gasLimit?: string;
};

/** Quote liquidity source; surfaced so consumers can render or sort on it. */
export type QuoteLiquiditySource = "RFQ" | "AMM";

/** Payout-chain network fee (fee paid on the destination chain, when applicable). */
export type QuotePayoutNetworkFees = {
  value: number;
  currencyId: string;
};

/** Flags advertised by the provider that affect the swap flow. */
export type QuoteTags = {
  isRegistrationRequired: boolean;
  isTokenApprovalRequired: boolean;
};

/** EVM token-approval transaction blob the swap SDK may need to broadcast. */
export type QuoteApprovalTransaction = {
  calldata: string;
  from: string;
  gasLimit: number;
  gasPrice: number;
  to: string;
  value: string;
};

/** Current token-allowance state for the send account / spender pair. */
export type QuoteTokenAllowance = {
  isApproved: boolean;
  approvedAmount?: string;
  approvalTransaction?: QuoteApprovalTransaction;
};

/**
 * EIP-712 Permit2 domain descriptor.
 * See https://eips.ethereum.org/EIPS/eip-712 and Uniswap's Permit2 contracts.
 */
export type QuotePermit2Domain = {
  name: string;
  chainId: number;
  verifyingContract: string;
};

/** Permit2 details: token + amount + expiration + nonce. */
export type QuotePermit2Details = {
  token: string;
  amount: string;
  expiration: string;
  nonce: string;
};

/** Permit2 single-permit payload. */
export type QuotePermit2Single = {
  details: QuotePermit2Details;
  spender: string;
  sigDeadline: string;
};

/** EIP-712 type descriptors for a Permit2 payload. */
export type QuotePermit2Types = {
  EIP712Domain: Array<{ name: string; type: string }>;
  PermitSingle: Array<{ name: string; type: string }>;
  PermitDetails: Array<{ name: string; type: string }>;
};

/**
 * Partial Permit2 typed-data payload. Different providers populate different
 * branches (UniswapX uses `values`; 1inch-fusion uses `message`) and some rows
 * omit `primaryType` or the `EIP712Domain` type entry, so consumers should
 * tolerate missing fields.
 */
export type QuotePermit2Message = {
  values?: QuotePermit2Single;
  message?: QuotePermit2Single;
  domain?: QuotePermit2Domain;
  types?: QuotePermit2Types;
  primaryType?: "PermitSingle";
};

/**
 * Provider-specific execution-time payload for quote submission. Non-execution
 * consumers of `getQuotes` can safely ignore this field — it is consumed only
 * by the matching provider integration (UniswapX, 1inch-fusion, Velora). Each
 * subfield is populated only for the provider it belongs to; absence is normal.
 */
export type QuotePermitData = {
  /**
   * EIP-712 Permit2 typed-data payload. UniswapX rows expose it under the
   * `values` branch; 1inch-fusion rows expose it under the `message` branch
   * and additionally populate `orderHash`.
   */
  typedData?: QuotePermit2Message;
  /** 1inch-fusion order hash referenced at submission time. */
  orderHash?: string;
  /** Velora price-route payload; opaque to this contract. */
  priceRoute?: unknown;
  /** Raw provider tag e.g. `"UniswapDutchCustomFields"` (informational). */
  providerTag?: string;
};

/**
 * Wallet-computed network-fee estimate for the default fee strategy.
 * Amount is in atomic units serialized as a decimal string to preserve
 * precision for chains whose fees exceed `Number.MAX_SAFE_INTEGER`.
 * `currencyId` is duplicated from `networkFees.currencyId` intentionally so
 * consumers can read the pair without cross-referencing other fields.
 */
export type QuoteEstimatedNetworkFee = {
  amount: string;
  currencyId: string;
};

/**
 * Wallet-computed extra network fee attributable to a token-approval transaction
 * that must precede the swap (EVM only, when `tokenAllowance.isApproved === false`).
 * Shaped identically to {@link QuoteEstimatedNetworkFee}; kept as its own field so
 * consumers can display a split breakdown ("Network: X, Token approval: Y") and/or
 * sum the two for a total cost. Absent when no approval is required.
 */
export type QuoteApprovalNetworkFee = QuoteEstimatedNetworkFee;

export type QuoteDetails = {
  type: TradeMethod;
  sendAmount: number;
  receiveAmount: number;
  gasLess: boolean;
  networkFees: QuoteNetworkFees;
  slippage: number;
  exchangeRate: number;
  /**
   * Additive optional fields introduced by the wallet-side quotes migration.
   * Not every producer populates them today; consumers must handle `undefined`.
   * See plan `usegetquotes_wallet_migration_inventory` for ownership.
   */
  liquiditySource?: QuoteLiquiditySource;
  payoutNetworkFees?: QuotePayoutNetworkFees;
  tokenAllowance?: QuoteTokenAllowance;
  tags?: QuoteTags;
  permitData?: QuotePermitData;
  estimatedNetworkFee?: QuoteEstimatedNetworkFee;
  approvalNetworkFee?: QuoteApprovalNetworkFee;
};

export type Quote = {
  id?: string;
  key: string;
  provider: string;
  providerDetails: ProviderDetails;
  quoteDetails: QuoteDetails;
  warning: QuoteWarning | null;
  error: QuoteError | null;
};

/** Error rows returned next to quotes (swap API error objects). */
export type QuoteProviderError = {
  code: string;
  type: TradeMethod;
  provider: string;
  message: string;
  parameter: { [key: string]: string };
};

export type GetQuotesResponse = {
  quotes: Quote[];
  errors: QuoteProviderError[];
};
