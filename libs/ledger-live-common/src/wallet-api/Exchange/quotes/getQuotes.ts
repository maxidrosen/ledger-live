import { getEnv } from "@ledgerhq/live-env";
import { AccountLike } from "@ledgerhq/types-live";

import { fetchAndMergeProviderData } from "../../../exchange/providers/swap";
import { fetchQuotes } from "./service/fetchQuotes";
import { normalizeQuote } from "./normalizer";
import type { GetQuotesArgs, GetQuotesResponse } from "./types";
import { isUnsupportedPair } from "./unsupportedPairs";

/**
 * Server-side dependencies for {@link getQuotes}. Not part of the public
 * wire contract: `GetQuotesWireArgs` stays minimal, and each caller of
 * `getQuotes` is responsible for constructing a `GetQuotesContext` from
 * the wallet state it already has on hand.
 *
 * The wallet-api RPC handler in `server.ts` fills this from the
 * `handlers({ accounts, ... })` factory arg. Native callers inside
 * ledger-live-desktop or ledger-live-mobile would build it from their
 * Redux store. Tests build it inline.
 *
 * Fields:
 *   - `accounts`: the wallet's accounts, used by downstream wallet-side
 *     steps (fee estimation via account bridges — not consumed yet).
 *   - `spotPrices`: map of currencyId → USD spot price, keyed the same
 *     way as `QuotesInput.sendCurrencyId` / `receiveCurrencyId`. Used
 *     by `normalizeQuote` to emit the `unrealisticQuote` warning when
 *     the quote's output fiat value exceeds its input fiat value.
 *     Callers without spot prices on hand pass an empty `{}` — the
 *     unrealistic check then short-circuits and no warning is emitted,
 *     matching the legacy "missing prices ⇒ no decision" branch.
 */
export type GetQuotesContext = {
  accounts: AccountLike[];
  spotPrices: Record<string, number>;
};

export async function getQuotes(
  args: GetQuotesArgs,
  context: GetQuotesContext,
): Promise<GetQuotesResponse> {
  const { rawQuotes, errors } = await fetchQuotes(args);

  // Drop every successful quote when the pair is on the wallet-side
  // blocklist. Errors returned by the aggregator flow through untouched so
  // consumers can still surface provider-level failures for the same pair.
  // The fetch itself is not short-circuited to keep behavior parity with
  // the legacy `useGetQuotes` filter during the migration; revisit once
  // `useGetQuotes` is quarantined.
  const filteredRawQuotes = isUnsupportedPair(args.data.sendCurrencyId, args.data.receiveCurrencyId)
    ? []
    : rawQuotes;

  const ledgerSignatureEnv = getEnv("MOCK_EXCHANGE_TEST_CONFIG") ? "test" : "prod";
  const partnerSignatureEnv = getEnv("MOCK_EXCHANGE_TEST_PARTNER") ? "test" : "prod";
  const providerData = await fetchAndMergeProviderData({
    ledgerSignatureEnv,
    partnerSignatureEnv,
  });

  const unrealisticInput = {
    sendCurrencyId: args.data.sendCurrencyId,
    receiveCurrencyId: args.data.receiveCurrencyId,
    spotPrices: context.spotPrices,
  };

  const quotes = filteredRawQuotes.map(raw => normalizeQuote(raw, providerData, unrealisticInput));

  return { quotes, errors };
}
