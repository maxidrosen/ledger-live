/**
 * Hardcoded cap that swap-live-app previously sourced from the
 * `ptxSwapAppConfig.decimals.default` Firebase feature flag. The wallet has
 * no access to that flag, so we fix the cap at the historical default value
 * used for crypto display. Callers apply
 * `Math.min(DEFAULT_MAX_DECIMALS, currencyDecimals)` when formatting.
 */
export const DEFAULT_MAX_DECIMALS = 8;

/**
 * Decimal cap used for fiat countervalue strings in swap-live-app's
 * `useGetFormattedSpotValue` (`limitDecimalsTo: 7`). Capped further by the
 * fiat magnitude (e.g. USD → 2), so the practical effect for USD/EUR is
 * `min(7, magnitude)` = `magnitude`.
 */
export const COUNTERVALUE_MAX_DECIMALS = 7;
