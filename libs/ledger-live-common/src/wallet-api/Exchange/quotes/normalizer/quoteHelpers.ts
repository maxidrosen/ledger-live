import type { QuoteLiquiditySource } from "../types";
import type { RawQuote } from "../service/types";

export function resolveQuoteId(quote: RawQuote): string | undefined {
  if (quote.quoteId) {
    return quote.quoteId;
  }
  const maybeQuoteId = quote.customFields?.quoteId;
  return typeof maybeQuoteId === "string" && maybeQuoteId.length > 0 ? maybeQuoteId : undefined;
}

export function normalizedProviderId(provider: string): string {
  return provider === "changelly_v2" ? "changelly" : provider;
}

export function isUniswapXQuote(quote: RawQuote): boolean {
  return Boolean(quote.customFields?.["@type"]?.includes("UniswapDutchCustomFields"));
}

// TODO: align with `computeLiquiditySource`. This reads the raw API field
// directly, which can disagree with the derived classification for providers
// like `oneinchfusion` or UniswapX rows where the raw `liquiditySource` is
// missing/unreliable. Kept as-is for byte-for-byte parity with the legacy
// `useGetQuotes` hook; fix in a dedicated follow-up so `gasLess` and the
// exposed `liquiditySource` agree by construction.
export function isGasLess(quote: RawQuote): boolean {
  return quote.liquiditySource === "RFQ";
}

/**
 * Classify a quote's liquidity source.
 *
 * Mirrors the swap live-app `getQuoteType` helper rather than trusting the raw
 * `liquiditySource` API field directly, because some providers (notably
 * `oneinchfusion` and UniswapDutch-tagged rows) signal RFQ semantics through
 * the provider id or `customFields["@type"]` tag instead of populating
 * `liquiditySource`.
 *
 * Returns `undefined` only for defensive exhaustiveness; every real-world row
 * hits either the RFQ or AMM branch.
 */
export function computeLiquiditySource(quote: RawQuote): QuoteLiquiditySource | undefined {
  const isUniswapX = isUniswapXQuote(quote);

  if (quote.provider === "oneinchfusion" || isUniswapX) {
    return "RFQ";
  }
  if (!isUniswapX || quote.provider === "oneinch") {
    return "AMM";
  }
  return undefined;
}

/**
 * Round fractional slippage to one decimal place. Safe integers pass through
 * untouched so canonical presets (0, 1, 2...) stay integers rather than being
 * coerced to floats. Providers occasionally return long fractional values
 * (e.g. `0.7775697944164467`) that would otherwise leak into downstream
 * display strings and callers that trust wallet-normalized numerics.
 */
export function normalizeSlippage(slippage: number): number {
  if (Number.isSafeInteger(slippage)) {
    return slippage;
  }
  return parseFloat(slippage.toFixed(1));
}
