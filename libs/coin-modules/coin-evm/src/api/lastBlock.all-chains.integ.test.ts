import { setupCalClientStore } from "@ledgerhq/cryptoassets/cal-client/test-helpers";
import { EvmConfig } from "../config";
import { createApi } from "./index";

/**
 * Chain configs extracted from @ledgerhq/live-common/families/evm/config.
 * Only chains that have a `node` config are included — chains without a node
 * entry (e.g. akroma, atheios, callisto …) have no reachable RPC and are
 * therefore excluded from this suite.
 */
const CHAINS: [string, EvmConfig][] = [
  // ── Ledger-managed nodes ──────────────────────────────────────────────────
  [
    "ethereum",
    {
      node: { type: "ledger", explorerId: "eth" },
      explorer: { type: "ledger", explorerId: "eth" },
      showNfts: false,
    },
  ],
  [
    "ethereum_classic",
    {
      node: { type: "ledger", explorerId: "etc" },
      explorer: { type: "ledger", explorerId: "etc" },
      showNfts: false,
    },
  ],
  [
    "bsc",
    {
      node: { type: "ledger", explorerId: "bnb" },
      explorer: { type: "ledger", explorerId: "bnb" },
      showNfts: false,
    },
  ],
  [
    "polygon",
    {
      node: { type: "ledger", explorerId: "matic" },
      explorer: { type: "ledger", explorerId: "matic" },
      showNfts: false,
    },
  ],
  [
    "avalanche_c_chain",
    {
      node: { type: "ledger", explorerId: "avax" },
      explorer: { type: "ledger", explorerId: "avax" },
      showNfts: false,
    },
  ],
  [
    "ethereum_sepolia",
    {
      node: { type: "ledger", explorerId: "eth_sepolia" },
      explorer: { type: "ledger", explorerId: "eth_sepolia" },
      showNfts: false,
    },
  ],
  [
    "ethereum_hoodi",
    {
      node: { type: "ledger", explorerId: "eth_hoodi" },
      explorer: { type: "ledger", explorerId: "eth_hoodi" },
      showNfts: false,
    },
  ],
  [
    "polygon_amoy",
    {
      node: { type: "ledger", explorerId: "matic_amoy" },
      explorer: { type: "ledger", explorerId: "matic_amoy" },
      showNfts: false,
    },
  ],

  // ── External nodes ────────────────────────────────────────────────────────
  [
    "avalanche_c_chain_fuji",
    {
      node: { type: "external", uri: "https://api.avax-test.network/ext/bc/C/rpc" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/43113",
      },
      showNfts: false,
    },
  ],
  [
    "arbitrum",
    {
      node: { type: "external", uri: "https://arbitrum.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/42161",
      },
      showNfts: false,
    },
  ],
  [
    "arbitrum_sepolia",
    {
      node: { type: "external", uri: "https://arbitrum-sepolia.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/421614",
      },
      showNfts: false,
    },
  ],
  [
    "astar",
    {
      node: { type: "external", uri: "https://astar.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://astar.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "base",
    {
      node: { type: "external", uri: "https://base.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/8453",
      },
      showNfts: false,
    },
  ],
  [
    "base_sepolia",
    {
      node: { type: "external", uri: "https://base-sepolia.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://base-sepolia.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "berachain",
    {
      node: { type: "external", uri: "https://berachain.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/80094",
      },
      showNfts: false,
    },
  ],
  [
    "bitlayer",
    {
      node: { type: "external", uri: "https://rpc.bitlayer.org" },
      explorer: { type: "none" },
      showNfts: false,
    },
  ],
  [
    "blast",
    {
      node: { type: "external", uri: "https://blast.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/81457",
      },
      showNfts: false,
    },
  ],
  [
    "blast_sepolia",
    {
      node: { type: "external", uri: "https://blast-sepolia.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/168587773",
      },
      showNfts: false,
    },
  ],
  [
    "bittorrent",
    {
      node: { type: "external", uri: "https://bittorrent.coin.ledger.com" },
      explorer: { type: "etherscan", uri: "https://proxyetherscan.api.live.ledger.com/v2/api/199" },
      showNfts: false,
    },
  ],
  [
    "boba",
    {
      node: { type: "external", uri: "https://boba.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://api.routescan.io/v2/network/mainnet/evm/288/etherscan",
      },
      showNfts: false,
    },
  ],
  [
    "core",
    {
      node: { type: "external", uri: "https://core.coin.ledger.com" },
      explorer: { type: "none" },
      showNfts: false,
    },
  ],
  [
    "cronos",
    {
      node: { type: "external", uri: "https://evm.cronos.org" },
      explorer: { type: "blockscout", uri: "https://cronos.org/explorer/api" },
      showNfts: false,
    },
  ],
  [
    "energy_web",
    {
      node: { type: "external", uri: "https://rpc.energyweb.org" },
      explorer: { type: "blockscout", uri: "https://explorer.energyweb.org/api" },
      showNfts: false,
    },
  ],
  [
    "etherlink",
    {
      node: { type: "external", uri: "https://node.mainnet.etherlink.com" },
      explorer: { type: "blockscout", uri: "https://explorer.etherlink.com/api" },
      showNfts: false,
    },
  ],
  [
    "fantom",
    {
      node: { type: "external", uri: "https://fantom.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://ftmscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "flare",
    {
      node: { type: "external", uri: "https://flare-api.flare.network/ext/bc/C/rpc" },
      explorer: { type: "blockscout", uri: "https://flare-explorer.flare.network/api" },
      showNfts: false,
    },
  ],
  [
    "hyperevm",
    {
      node: { type: "external", uri: "https://hyperliquid.coin.ledger.com" },
      explorer: { type: "etherscan", uri: "https://proxyetherscan.api.live.ledger.com/v2/api/999" },
      showNfts: false,
    },
  ],
  [
    "klaytn",
    {
      node: { type: "external", uri: "https://public-en-cypress.klaytn.net" },
      explorer: { type: "klaytnfinder", uri: "https://cypress-oapi.klaytnfinder.io/api" },
      showNfts: false,
    },
  ],
  [
    "klaytn_baobab",
    {
      node: { type: "external", uri: "https://api.baobab.klaytn.net:8651" },
      explorer: { type: "klaytnfinder", uri: "https://baobab-oapi.klaytnfinder.io/api" },
      showNfts: false,
    },
  ],
  [
    "linea",
    {
      node: { type: "external", uri: "https://linea.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/59144",
      },
      showNfts: false,
    },
  ],
  [
    "linea_sepolia",
    {
      node: { type: "external", uri: "https://linea-sepolia.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/59141",
      },
      showNfts: false,
    },
  ],
  [
    "lukso",
    {
      node: { type: "external", uri: "https://lukso.coin.ledger.com" },
      explorer: {
        type: "blockscout",
        uri: "https://explorer.execution.mainnet.lukso.network/api/v1/",
      },
      showNfts: false,
    },
  ],
  [
    "mantle",
    {
      node: { type: "external", uri: "https://rpc.mantle.xyz" },
      explorer: { type: "blockscout", uri: "https://explorer.mantle.xyz/api" },
      showNfts: false,
    },
  ],
  [
    "mantle_sepolia",
    {
      node: { type: "external", uri: "https://rpc.sepolia.mantle.xyz" },
      explorer: { type: "blockscout", uri: "https://explorer.sepolia.mantle.xyz/api" },
      showNfts: false,
    },
  ],
  [
    "metis",
    {
      node: { type: "external", uri: "https://metis.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://andromeda-explorer.metis.io/api" },
      showNfts: false,
    },
  ],
  [
    "monad",
    {
      node: { type: "external", uri: "https://monad.coin.ledger.com" },
      explorer: { type: "etherscan", uri: "https://proxyetherscan.api.live.ledger.com/v2/api/143" },
      showNfts: false,
    },
  ],
  [
    "monad_testnet",
    {
      node: { type: "external", uri: "https://monad-testnet.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/10143",
      },
      showNfts: false,
    },
  ],
  [
    "moonbeam",
    {
      node: { type: "external", uri: "https://moonbeam.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/1284",
      },
      showNfts: false,
    },
  ],
  [
    "moonriver",
    {
      node: { type: "external", uri: "https://moonriver.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/1285",
      },
      showNfts: false,
    },
  ],
  [
    "neon_evm",
    {
      node: { type: "external", uri: "https://neon-evm.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://neon.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "optimism",
    {
      node: { type: "external", uri: "https://optimism.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://optimism.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "optimism_sepolia",
    {
      node: { type: "external", uri: "https://optimism-sepolia.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://optimism-sepolia.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "polygon_zk_evm",
    {
      node: { type: "external", uri: "https://polygon-zkevm.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/1101",
      },
      showNfts: false,
    },
  ],
  [
    "polygon_zk_evm_testnet",
    {
      node: { type: "external", uri: "https://rpc.public.zkevm-test.net" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/1442",
      },
      showNfts: false,
    },
  ],
  [
    "rsk",
    {
      node: { type: "external", uri: "https://rsk.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://rootstock.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "scroll",
    {
      node: { type: "external", uri: "https://scroll.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://scroll.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "scroll_sepolia",
    {
      node: { type: "external", uri: "https://scroll-sepolia.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://scroll-sepolia.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "sei_evm",
    {
      node: { type: "external", uri: "https://sei-evm.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/1329",
      },
      showNfts: false,
    },
  ],
  [
    "shape",
    {
      node: { type: "external", uri: "https://mainnet.shape.network" },
      explorer: { type: "blockscout", uri: "https://shapescan.xyz/api" },
      showNfts: false,
    },
  ],
  [
    "somnia",
    {
      node: { type: "external", uri: "https://somnia-rpc.publicnode.com" },
      explorer: { type: "blockscout", uri: "https://explorer.somnia.network/api" },
      showNfts: false,
    },
  ],
  [
    "songbird",
    {
      node: { type: "external", uri: "https://songbird-api.flare.network/ext/C/rpc" },
      explorer: { type: "blockscout", uri: "https://songbird-explorer.flare.network/api" },
      showNfts: false,
    },
  ],
  [
    "sonic",
    {
      node: { type: "external", uri: "https://sonic.coin.ledger.com" },
      explorer: { type: "etherscan", uri: "https://proxyetherscan.api.live.ledger.com/v2/api/146" },
      showNfts: false,
    },
  ],
  [
    "sonic_blaze",
    {
      node: { type: "external", uri: "https://sonic-blaze.coin.ledger.com" },
      explorer: {
        type: "etherscan",
        uri: "https://proxyetherscan.api.live.ledger.com/v2/api/57054",
      },
      showNfts: false,
    },
  ],
  [
    "story",
    {
      node: { type: "external", uri: "https://story.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://www.storyscan.io/api" },
      showNfts: false,
    },
  ],
  [
    "syscoin",
    {
      node: { type: "external", uri: "https://syscoin.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://explorer.syscoin.org/api" },
      showNfts: false,
    },
  ],
  [
    "telos_evm",
    {
      node: { type: "external", uri: "https://telos-evm.coin.ledger.com" },
      explorer: { type: "teloscan", uri: "https://api.teloscan.io/api" },
      showNfts: false,
    },
  ],
  [
    "unichain",
    {
      node: { type: "external", uri: "https://unichain-rpc.publicnode.com" },
      explorer: { type: "blockscout", uri: "https://unichain.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "unichain_sepolia",
    {
      node: { type: "external", uri: "https://unichain-sepolia-rpc.publicnode.com" },
      explorer: { type: "blockscout", uri: "https://unichain-sepolia.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "velas_evm",
    {
      node: { type: "external", uri: "https://evmexplorer.velas.com/rpc" },
      explorer: { type: "blockscout", uri: "https://evmexplorer.velas.com/api" },
      showNfts: false,
    },
  ],
  [
    "zero_gravity",
    {
      node: { type: "external", uri: "https://zero-gravity.coin.ledger.com" },
      explorer: { type: "none" },
      showNfts: false,
    },
  ],
  [
    "zksync",
    {
      node: { type: "external", uri: "https://zksync.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://zksync.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "zksync_sepolia",
    {
      node: { type: "external", uri: "https://zksync-sepolia.coin.ledger.com" },
      explorer: { type: "blockscout", uri: "https://zksync-sepolia.blockscout.com/api" },
      showNfts: false,
    },
  ],
  [
    "adi",
    {
      node: { type: "external", uri: "https://rpc.adifoundation.ai" },
      explorer: { type: "blockscout", uri: "https://explorer-bls.adifoundation.ai/api" },
      showNfts: false,
    },
  ],
];

describe.each(CHAINS)("lastBlock on %s", (currencyId, config) => {
  let module: ReturnType<typeof createApi>;

  beforeAll(() => {
    setupCalClientStore();
    module = createApi(config, currencyId);
  });

  it("returns a valid last block", async () => {
    const result = await module.lastBlock();

    expect(result.hash).toMatch(/^0x[A-Fa-f0-9]{64}$/);
    expect(result.height).toBeGreaterThan(0);
    expect(result.time).toBeInstanceOf(Date);
    expect(result.time.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});
