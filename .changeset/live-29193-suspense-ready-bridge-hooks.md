---
"@ledgerhq/live-common": minor
"ledger-live-desktop": patch
"live-mobile": patch
---

Add `useAccountBridge` hook that returns an `AccountBridge` synchronously using
React `use()` with a pre-annotated fulfilled Promise (zero suspension today;
will suspend once when `getAccountBridge` becomes truly async).

Refactor `useBridgeTransaction` to accept `bridge` as an explicit first argument
and initialise state synchronously via `useReducer`'s lazy initialiser, removing
the previous `use(Promise)` suspension path entirely.

All call sites in desktop and mobile updated to obtain the bridge via
`useAccountBridge` and pass it as the first argument to `useBridgeTransaction`.

Requires a `<Suspense>` boundary in the parent tree (LIVE-29193).
