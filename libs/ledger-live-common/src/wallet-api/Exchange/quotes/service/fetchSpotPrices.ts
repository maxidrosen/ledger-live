import URL from "url";

import { getEnv } from "@ledgerhq/live-env";
import network from "@ledgerhq/live-network";

/**
 * Arguments for {@link fetchSpotPrices}.
 *
 * Intentionally narrow: callers pass a flat list of `currencyIds` and a
 * single `counterValue` ticker. Duplicates and falsy ids are stripped
 * inside the helper so callers can pass the three IDs that matter for
 * quote fetching (`sendCurrencyId`, `receiveCurrencyId`,
 * `networkFeesCurrencyId`) without first deduping.
 */
export type FetchSpotPricesArgs = {
  currencyIds: Array<string | undefined>;
  counterValue: string;
};

/**
 * Cache TTL in milliseconds. Spot prices drift slowly relative to the
 * swap-live-app quote refresh interval (~20s), so a 30s TTL keeps the
 * countervalues round-trip off the hot path for the typical user
 * session while still picking up meaningful price moves within a few
 * refresh cycles.
 */
const SPOT_PRICE_TTL_MS = 30_000;

type SpotPriceCacheEntry = { price: number; expiresAt: number };

/**
 * Per-currency in-memory cache keyed by `{baseURL}|{to}|{currencyId}`.
 * Keeping the baseURL in the key prevents staging/prod env flips from
 * serving stale cross-environment data; keeping `to` in the key keeps
 * USD/EUR quotes isolated from each other. The cache only ever stores
 * successfully-fetched prices — failed fetches leave existing entries
 * untouched, so a transient 5xx doesn't blow away a fresh cache.
 */
const spotPriceCache = new Map<string, SpotPriceCacheEntry>();

function cacheKey(baseURL: string, to: string, currencyId: string): string {
  return `${baseURL}|${to}|${currencyId}`;
}

/** Test-only reset hook. Do NOT call from production code. */
export function __resetSpotPriceCacheForTests(): void {
  spotPriceCache.clear();
}

/**
 * Fetch Ledger spot prices for the given currency ids against a single
 * counter-value, keyed the same way as `GetQuotesContext.spotPrices`
 * (e.g. `{ ethereum: 3200, bitcoin: 65000 }` for `counterValue: "usd"`).
 *
 * Caches per currency id for {@link SPOT_PRICE_TTL_MS}. Subsequent calls
 * with overlapping currency ids only fetch the expired / unseen subset,
 * so the common case of a swap screen refreshing quotes every 20s
 * resolves entirely from cache after the first tick.
 *
 * Best-effort: returns whatever subset is known (cached + freshly
 * fetched) on partial failures, and `{}` when no cache exists and the
 * network call fails. The downstream `unrealisticQuote` check
 * short-circuits on a missing key, so an empty map is equivalent to
 * "no warning" — matching the legacy hook's "missing prices ⇒ no
 * decision" branch. We never throw here because a failed countervalues
 * call must not block the swap-quote pipeline.
 *
 * Uses `@ledgerhq/live-network` for HTTP so staging-environment
 * overrides and network logging behave like every other ledger-live API
 * call. Endpoint matches the legacy swap-live-app `useSpotPrices`
 * (`/v3/spot/simple?to=...&froms=...`).
 */
export async function fetchSpotPrices(args: FetchSpotPricesArgs): Promise<Record<string, number>> {
  const froms = Array.from(
    new Set(args.currencyIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
  );
  if (froms.length === 0) {
    return {};
  }

  const baseURL = getEnv("LEDGER_COUNTERVALUES_API");
  const to = args.counterValue.toLowerCase();
  const now = Date.now();

  const result: Record<string, number> = {};
  const missing: string[] = [];

  for (const id of froms) {
    const hit = spotPriceCache.get(cacheKey(baseURL, to, id));
    if (hit && hit.expiresAt > now) {
      result[id] = hit.price;
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) {
    return result;
  }

  try {
    const url = URL.format({
      pathname: `${baseURL}/v3/spot/simple`,
      query: { to, froms: missing.join(",") },
    });
    const { data } = await network<Record<string, number>>({ method: "GET", url });
    if (data && typeof data === "object") {
      const expiresAt = Date.now() + SPOT_PRICE_TTL_MS;
      for (const [id, price] of Object.entries(data)) {
        if (typeof price === "number") {
          spotPriceCache.set(cacheKey(baseURL, to, id), { price, expiresAt });
          result[id] = price;
        }
      }
    }
  } catch {
    // swallow — return whatever cache hits / partial fetches we already
    // collected. A failed countervalues call must never block quotes.
  }

  return result;
}
