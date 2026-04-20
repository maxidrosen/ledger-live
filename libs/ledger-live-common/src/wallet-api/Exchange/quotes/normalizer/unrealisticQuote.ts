import BigNumber from "bignumber.js";

import type { RawQuote } from "../service/types";
import type { QuoteWarning } from "../types";

/**
 * Inputs required to classify a quote as `unrealisticQuote`. Mirrors the
 * shape consumed by the legacy `computeQuoteGainPercent` helper in the
 * swap-live-app so that byte-for-byte parity is achievable during the
 * migration.
 *
 * Callers that do not have spot prices on hand pass empty values; the
 * helper returns `null` in that case, matching the legacy "missing
 * prices ⇒ no decision" branch.
 */
export type UnrealisticQuoteInput = {
  sendCurrencyId: string;
  receiveCurrencyId: string;
  spotPrices: Record<string, number>;
};

/**
 * Returns a ready-to-emit `unrealisticQuote` warning when the quote's
 * output fiat value exceeds its input fiat value, using the caller-
 * provided spot prices. Returns `null` when the check is impossible
 * (missing amounts, missing prices, zero denominator) or when the
 * gain is non-positive.
 *
 * Mirrors `computeQuoteGainPercent` from the legacy
 * `apps/live-app/src/queries/useGetQuotes/computeQuoteGainPercent.ts`
 * character-for-character so the wallet-side emission stays in lockstep
 * with the frozen reference implementation.
 */
export function computeUnrealisticQuote(
  quote: RawQuote,
  input: UnrealisticQuoteInput,
): QuoteWarning | null {
  const fromSpot = input.spotPrices[input.sendCurrencyId];
  const toSpot = input.spotPrices[input.receiveCurrencyId];
  const amountFrom = quote.amountFrom;

  if (amountFrom == null || amountFrom === 0 || !fromSpot || !toSpot) {
    return null;
  }

  const amountFromFiat = BigNumber(amountFrom).multipliedBy(fromSpot);
  const amountToFiat = BigNumber(quote.amountTo).multipliedBy(toSpot);

  if (amountFromFiat.isZero() || amountFromFiat.isNaN()) {
    return null;
  }

  const gainPercent = amountToFiat.dividedBy(amountFromFiat).minus(1).multipliedBy(100);

  if (!gainPercent.isGreaterThan(0)) {
    return null;
  }

  return { code: "unrealisticQuote", gainPercent: gainPercent.toNumber() };
}
