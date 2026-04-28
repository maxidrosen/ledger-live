import { Account } from "@ledgerhq/live-common/e2e/enum/Account";
import { Provider } from "@ledgerhq/live-common/e2e/enum/Provider";
import { runSwapLnsNotSupportedBannerTest } from "./swap.other";

runSwapLnsNotSupportedBannerTest(
  Account.ETH_1,
  Account.BTC_NATIVE_SEGWIT_1,
  Provider.LIFI,
  ["B2CQA-3389"],
  ["@LNS", "@ethereum", "@family-evm", "@bitcoin", "@family-bitcoin"],
);
