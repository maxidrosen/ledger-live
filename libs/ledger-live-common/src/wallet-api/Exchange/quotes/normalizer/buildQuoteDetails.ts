import type { RawQuote } from "../service/types";
import type { Quote } from "../types";
import { computeLiquiditySource, normalizeSlippage } from "./quoteHelpers";

export function buildQuoteDetails(quote: RawQuote, gasLess: boolean): Quote["quoteDetails"] {
  const raw = quote.networkFees;
  const networkFees: Quote["quoteDetails"]["networkFees"] = {
    currencyId: raw.currency,
  };
  if (raw.gasLimit !== undefined && raw.gasLimit !== "") {
    networkFees.gasLimit = raw.gasLimit;
  }

  const details: Quote["quoteDetails"] = {
    type: quote.type,
    sendAmount: quote.amountFrom ?? 0,
    receiveAmount: quote.amountTo,
    gasLess,
    networkFees,
    slippage: normalizeSlippage(quote.slippage),
    exchangeRate: quote.exchangeRate,
  };

  const liquiditySource = computeLiquiditySource(quote);
  if (liquiditySource !== undefined) {
    details.liquiditySource = liquiditySource;
  }

  return details;
}
