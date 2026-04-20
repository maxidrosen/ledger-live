---
"@ledgerhq/live-common": minor
---

Wallet-side Swap quotes: context plumbing, `unrealisticQuote` warning, schema cleanup

- Widen `getQuotes(args)` to `getQuotes(args, context)`; `GetQuotesContext` carries wallet state (`accounts`, `spotPrices`) supplied by each caller.
- Emit `{ code: "unrealisticQuote", gainPercent }` on `QuoteDetails.warning` when output fiat exceeds input fiat, using caller-provided spot prices. The `custom.exchange.getQuotes` RPC handler passes `spotPrices: {}` for now with a `TODO(unrealistic-quote-fetch)` marker.
- Narrow `QuoteWarning` to a single-member discriminated union (`{ code: "unrealisticQuote"; gainPercent: number }`) now that `highSpread` has no producer.
