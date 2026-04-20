---
"live-mobile": minor
"@ledgerhq/live-common": minor
"@ledgerhq/wallet-api-exchange-module": minor
---

Normalize additional Swap quote fields inside the Wallet API

- Map `payoutNetworkFees` to the wallet schema, remapping `currency` to `currencyId` and preserving zero values.
- Map `tokenAllowanceData` to `tokenAllowance`, preserving its deep structure including `approvalTransaction`.
- Mirror `tags` (`isRegistrationRequired`, `isTokenApprovalRequired`) from the raw quote onto `QuoteDetails` so KYC and token-approval gating is driven by the wallet-normalized shape instead of the raw API payload.
- Hoist the legacy `customFields` permit bag into a single optional `permitData` envelope on `QuoteDetails`. `typedData` prefers `customFields.permitData` (UniswapX) over `customFields.quoteResponse.typedData` (1inch-fusion); `orderHash`, `priceRoute`, and `providerTag` (from `customFields["@type"]`) ride alongside so non-Swap consumers don't have to know about the raw `customFields` layout.
- Enforce a wallet-side unsupported-pair blocklist (currently `near <-> stellar`, direction-agnostic) inside `getQuotes`. Quotes for blocked pairs are dropped post-fetch; aggregator errors for the same pair continue to flow through untouched.
