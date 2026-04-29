import "../../__tests__/test-helpers/setup.integration";
import cosmosCoinConfig, { type CosmosCoinConfig } from "@ledgerhq/coin-cosmos/config";
import { CosmosAPI } from "@ledgerhq/coin-cosmos/network/Cosmos";
import { LiveConfig } from "@ledgerhq/live-config/LiveConfig";
import { getCurrencyConfiguration } from "../../config";
import { cosmosConfig } from "./config";

LiveConfig.setConfig(cosmosConfig);

/**
 * Wire the coin config so that CosmosAPI's internal cryptoFactory picks up the
 * LCD endpoint from cosmosConfig (via LiveConfig) instead of relying on the
 * hardcoded chain-class defaults.
 */
cosmosCoinConfig.setCoinConfig(currencyId => {
  if (!currencyId) throw new Error("currencyId is required");
  return getCurrencyConfiguration<CosmosCoinConfig>(currencyId);
});

/**
 * Currency IDs are derived by stripping the `config_currency_` prefix from
 * each key in cosmosConfig (e.g. `config_currency_cosmos` → `cosmos`).
 * Every Cosmos chain has an LCD endpoint, so no additional filtering is needed.
 */
const CURRENCY_IDS = Object.keys(cosmosConfig).map(key => key.replace(/^config_currency_/, ""));

describe.each(CURRENCY_IDS)("getHeight on %s", currencyId => {
  it("returns a positive block height", async () => {
    const api = new CosmosAPI(currencyId);
    const height = await api.getHeight();

    expect(height).toBeGreaterThan(0);
  });
});
