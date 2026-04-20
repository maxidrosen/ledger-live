import type { RawQuote } from "../service/types";
import type { Quote } from "../types";
import type { ProviderData } from "../lookupProviderConfig";
import { buildProviderDetails } from "./buildProviderDetails";
import { buildQuoteDetails } from "./buildQuoteDetails";
import { computeError, computeWarning } from "./computeQuoteStatus";
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
 * Enrich one raw HTTP quote row using the full swap `providerData` catalog (CAL + CDN).
 *
 * `input` carries the auxiliary context needed to decide status-flavored
 * fields that depend on more than the raw quote itself (currently only
 * `unrealisticQuote` warning emission, which needs the pair's spot
 * prices). Optional so unit tests that do not exercise the warning path
 * don't have to thread fixtures through; production callers via
 * `getQuotes` always supply a concrete input.
 */
export function normalizeQuote(
  rawQuote: RawQuote,
  providerData: ProviderData,
  input: UnrealisticQuoteInput = EMPTY_UNREALISTIC_INPUT,
): Quote {
  const provider = normalizedProviderId(rawQuote.provider);
  const gasLess = isGasLess(rawQuote);

  return {
    id: resolveQuoteId(rawQuote),
    key: rawQuote.key ?? `${provider}-${rawQuote.type}`,
    provider,
    providerDetails: buildProviderDetails(rawQuote, providerData),
    quoteDetails: buildQuoteDetails(rawQuote, gasLess),
    warning: computeWarning(rawQuote, input),
    error: computeError(rawQuote),
  };
}
