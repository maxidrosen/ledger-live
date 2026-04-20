import { getEnv } from "@ledgerhq/live-env";

import { fetchAndMergeProviderData } from "../../../exchange/providers/swap";
import { fetchQuotes } from "./service/fetchQuotes";
import { normalizeQuote } from "./normalizer";
import type { GetQuotesArgs, GetQuotesResponse } from "./types";
import { isUnsupportedPair } from "./unsupportedPairs";

export async function getQuotes(args: GetQuotesArgs): Promise<GetQuotesResponse> {
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

  const quotes = filteredRawQuotes.map(raw => normalizeQuote(raw, providerData));

  return { quotes, errors };
}
