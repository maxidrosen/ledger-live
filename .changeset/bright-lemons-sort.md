---
"@ledgerhq/coin-aleo": minor
"@ledgerhq/live-common": minor
---

Add Aleo `recordPickingStrategy` support in `prepareTransaction` so private amount records are selected according to config (`manual` keeps user selection, `auto` picks the best available record), with unit-test coverage for both paths.
