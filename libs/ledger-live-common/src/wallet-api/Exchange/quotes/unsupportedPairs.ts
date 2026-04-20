/**
 * Hard-coded blocklist of currency pairs the Swap Wallet API refuses to
 * surface quotes for, independently of what the upstream aggregator returns.
 *
 * Matches the legacy `useGetQuotes` per-quote filter
 * (`near <-> stellar`) which was added before the backend enforced the
 * same rule.
 *
 * Each entry is direction-agnostic: `[a, b]` blocks both `a -> b` and
 * `b -> a`. Keep entries lowercased so comparison is straightforward.
 *
 * TODO: migrate to a remote feature-flag config once the backend can emit
 * this decision alongside the quote response (tracked by the broader
 * quotes-wallet migration).
 */
const UNSUPPORTED_PAIRS: ReadonlyArray<readonly [string, string]> = [["near", "stellar"]];

/**
 * Returns `true` when the (sendCurrencyId, receiveCurrencyId) pair is on the
 * wallet-side blocklist in either direction.
 */
export function isUnsupportedPair(sendCurrencyId: string, receiveCurrencyId: string): boolean {
  return UNSUPPORTED_PAIRS.some(
    ([a, b]) =>
      (sendCurrencyId === a && receiveCurrencyId === b) ||
      (sendCurrencyId === b && receiveCurrencyId === a),
  );
}
