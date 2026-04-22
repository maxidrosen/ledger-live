import type { FormatContext } from "../format/types";
import type { RawQuote } from "../service/types";
import type { Quote } from "../types";
import type { ProviderData } from "../lookupProviderConfig";
import { buildFormattedQuoteValues } from "./buildFormattedQuoteValues";
import { buildProviderDetails } from "./buildProviderDetails";
import { buildQuoteDetails } from "./buildQuoteDetails";
import { computeError, computeWarning } from "./computeQuoteStatus";
import type { FeeEstimate } from "./networkFeeEstimate";
import { isGasLess, normalizedProviderId, resolveQuoteId } from "./quoteHelpers";
import type { UnrealisticQuoteInput } from "./unrealisticQuote";

/**
 * Default `unrealisticQuote` input used when a caller does not supply
 * one. Keeps the helper a pure function — empty `spotPrices` means the
 * unrealistic check short-circuits and no warning is emitted, which is
 * exactly the legacy behavior when spot prices are missing.
 */
const EMPTY_UNREALISTIC_INPUT: UnrealisticQuoteInput = {
  sendCurrencyId: "",
  receiveCurrencyId: "",
  spotPrices: {},
};

/**
 * Enrich one raw HTTP quote row using the full swap `providerData`
 * catalog (CAL + CDN).
 *
 * @param rawQuote - Raw row emitted by the aggregator HTTP response.
 * @param providerData - Merged CAL + CDN catalog used to stamp provider
 *   display metadata.
 * @param input - Auxiliary context for status-flavored fields (currently
 *   only `unrealisticQuote` warning emission, which needs spot prices).
 *   Defaults to {@link EMPTY_UNREALISTIC_INPUT} so unit tests that don't
 *   exercise the warning path can omit it.
 * @param feeEstimate - Wallet-side default-strategy fee estimate from
 *   {@link computeFeeEstimate}. When absent, `estimatedNetworkFee` /
 *   `approvalNetworkFee` stay undefined and `notEnoughBalanceForFees` is
 *   not emitted.
 * @param formatContext - Locale / counter-value fiat / resolved currency
 *   metadata needed to produce `Quote.formatted`. When absent, the
 *   returned quote omits `formatted` and consumers fall back to their
 *   own formatting pipeline.
 * @returns The wire-shaped {@link Quote} (including optional `formatted`
 *   when `formatContext` was supplied).
 */
export function normalizeQuote(
  rawQuote: RawQuote,
  providerData: ProviderData,
  input: UnrealisticQuoteInput = EMPTY_UNREALISTIC_INPUT,
  feeEstimate?: FeeEstimate,
  formatContext?: FormatContext,
): Quote {
  const provider = normalizedProviderId(rawQuote.provider);
  const gasLess = isGasLess(rawQuote);
  const quoteDetails = buildQuoteDetails(rawQuote, gasLess, feeEstimate);

  const quote: Quote = {
    id: resolveQuoteId(rawQuote),
    key: rawQuote.key ?? `${provider}-${rawQuote.type}`,
    provider,
    providerDetails: buildProviderDetails(rawQuote, providerData),
    quoteDetails,
    warning: computeWarning(rawQuote, input),
    error: computeError(rawQuote, feeEstimate),
  };

  if (formatContext) {
    quote.formatted = buildFormattedQuoteValues(quoteDetails, feeEstimate, formatContext);
  }

  return quote;
}
