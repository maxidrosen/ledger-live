import { NotEnoughBalanceFees } from "@ledgerhq/errors";

type ErrorMatcher = {
  pattern: RegExp;
  createError: (match: RegExpMatchArray) => Error;
};

const balanceErrorMatchers: ErrorMatcher[] = [
  {
    // "Balance of gas object 10 is lower than the needed amount: 100"
    pattern: /Balance of gas object \d+ is lower than the needed amount:\s*\d+/i,
    createError: () => new NotEnoughBalanceFees(),
  },
  {
    // "Insufficient balance of 0x2::sui::SUI for owner 0xabc...
    //  Required: 1000, Available: 500"
    pattern: /Insufficient balance of .+ for owner/i,
    createError: () => new NotEnoughBalanceFees(),
  },
  // Add more patterns here as you discover them
];

/**
 * In order to provide better onward journeys for the users in swap we try to map
 * the errors coming from the Sui SDK dry-run into more specific errors that we can handle in the UI.
 * @param error
 * @returns
 */
export const mapDryRunError = (error: unknown): Error => {
  const message = extractErrorMessage(error);
  if (!message) return error instanceof Error ? error : new Error(String(error));

  for (const { pattern, createError } of balanceErrorMatchers) {
    const match = message.match(pattern);
    if (match) return createError(match);
  }

  return error instanceof Error ? error : new Error(message);
};

const extractErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message: unknown };
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
};
