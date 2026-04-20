import type { RawQuote } from "../service/types";
import type { QuoteError, QuoteWarning } from "../types";
import { computeUnrealisticQuote, type UnrealisticQuoteInput } from "./unrealisticQuote";

/**
 * Chooses the single `QuoteWarning` to surface on a normalized quote.
 *
 * `QuoteWarning` is a single-variant field today (`unrealisticQuote`) but is
 * shaped as a discriminated union so future signals can be added without
 * reshaping call sites. Callers without spot prices pass an empty
 * `spotPrices` map; the unrealistic check short-circuits and `null` is
 * returned, matching the legacy "missing prices ⇒ no decision" branch.
 */
export function computeWarning(quote: RawQuote, input: UnrealisticQuoteInput): QuoteWarning | null {
  return computeUnrealisticQuote(quote, input);
}

export function computeError(_quote: RawQuote): QuoteError | null {
  return null;
}
