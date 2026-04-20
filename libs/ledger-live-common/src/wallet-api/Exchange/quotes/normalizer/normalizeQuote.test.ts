import type { ProviderData } from "../lookupProviderConfig";
import type { RawQuote } from "../service/types";
import { normalizeQuote } from "./normalizeQuote";

/**
 * Minimal `RawQuote` factory. Each test overrides only the fields it exercises
 * so we do not over-specify shared fixtures and accidentally couple unrelated
 * test blocks to each other.
 */
function makeRawQuote(overrides: Partial<RawQuote> = {}): RawQuote {
  return {
    provider: "lifi",
    providerType: "DEX",
    type: "float",
    amountFrom: 50,
    amountTo: 49.864507,
    exchangeRate: 0.99729014,
    slippage: 0,
    networkFees: { currency: "ethereum" },
    tags: { isRegistrationRequired: false, isTokenApprovalRequired: false },
    key: "lifi-float-ethereum",
    liquiditySource: "AMM",
    ...overrides,
  };
}

const emptyProviderData: ProviderData = {};

describe("normalizeQuote", () => {
  describe("quoteDetails.slippage — integer-vs-fractional tidy", () => {
    it.each<[number, number]>([
      [0, 0],
      [1, 1],
      [2, 2],
    ])("passes safe-integer slippage %p through untouched", (input, expected) => {
      const quote = normalizeQuote(makeRawQuote({ slippage: input }), emptyProviderData);
      expect(quote.quoteDetails.slippage).toBe(expected);
    });

    // Canonical lifi case observed in production and asserted by the
    // swap-live-app legacy `useGetQuotes` characterization spec.
    it("rounds the lifi 0.7775697944164467 case to 0.8", () => {
      const quote = normalizeQuote(
        makeRawQuote({ slippage: 0.7775697944164467 }),
        emptyProviderData,
      );
      expect(quote.quoteDetails.slippage).toBe(0.8);
    });

    it.each<[number, number]>([
      [0.05, 0.1],
      [0.04, 0],
      [0.123456, 0.1],
      [0.99, 1],
    ])("rounds fractional slippage %p to %p (1 decimal place)", (input, expected) => {
      const quote = normalizeQuote(makeRawQuote({ slippage: input }), emptyProviderData);
      expect(quote.quoteDetails.slippage).toBe(expected);
    });
  });

  describe("quoteDetails.liquiditySource — RFQ / AMM classification", () => {
    it("marks oneinchfusion rows as RFQ regardless of @type", () => {
      const quote = normalizeQuote(
        makeRawQuote({ provider: "oneinchfusion", customFields: {} }),
        emptyProviderData,
      );
      expect(quote.quoteDetails.liquiditySource).toBe("RFQ");
    });

    it("marks UniswapDutchCustomFields-tagged rows as RFQ", () => {
      const quote = normalizeQuote(
        makeRawQuote({
          provider: "uniswap",
          customFields: { "@type": "UniswapDutchCustomFields" },
        }),
        emptyProviderData,
      );
      expect(quote.quoteDetails.liquiditySource).toBe("RFQ");
    });

    it("marks oneinch (classic, non-fusion) rows as AMM", () => {
      const quote = normalizeQuote(
        makeRawQuote({ provider: "oneinch", customFields: {} }),
        emptyProviderData,
      );
      expect(quote.quoteDetails.liquiditySource).toBe("AMM");
    });

    it("falls back to AMM when no @type tag is present and the provider is neither oneinchfusion nor a UniswapDutch row", () => {
      const quote = normalizeQuote(
        makeRawQuote({ provider: "lifi", customFields: undefined }),
        emptyProviderData,
      );
      expect(quote.quoteDetails.liquiditySource).toBe("AMM");
    });

    it("ignores the raw `liquiditySource` API field (classification is derived from provider + @type)", () => {
      // Raw says RFQ but provider is a classic AMM row: output stays AMM.
      const quote = normalizeQuote(
        makeRawQuote({
          provider: "lifi",
          customFields: undefined,
          liquiditySource: "RFQ",
        }),
        emptyProviderData,
      );
      expect(quote.quoteDetails.liquiditySource).toBe("AMM");
    });
  });
});
