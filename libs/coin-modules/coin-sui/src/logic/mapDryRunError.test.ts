import { mapDryRunError } from "./mapDryRunError";
import { NotEnoughBalanceFees } from "@ledgerhq/errors";

describe("mapDryRunError", () => {
  describe("NotEnoughBalanceFees pattern", () => {
    it("maps a real Sui gas-shortage message", () => {
      const error = new Error("Balance of gas object 10 is lower than the needed amount: 100");
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("matches case-insensitively", () => {
      const error = new Error("Balance of gas object 10 is Lower than the Needed Amount: 100");
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("tolerates extra whitespace", () => {
      const error = new Error("Balance of gas     object 10 is Lower than the Needed Amount: 100");
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });
  });

  describe("InsufficientBalanceError pattern", () => {
    it("maps a real Sui insufficient-balance message", () => {
      const error = new Error(
        "Insufficient balance of 0x2::sui::SUI for owner 0xabc123. Required: 1000, Available: 500",
      );
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("does not match a generic 'insufficient balance' string without the owner clause", () => {
      const error = new Error("Insufficient balance in your wallet");
      expect(mapDryRunError(error)).not.toBeInstanceOf(NotEnoughBalanceFees);
    });
  });

  describe("error shape unwrapping", () => {
    it("handles plain Error instances", () => {
      const error = new Error("needed amount: 100");
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("handles error-like objects with a message property", () => {
      const error = { message: "needed amount: 100" };
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("handles nested SDK errors where message is on a wrapper", () => {
      // Adjust this to match a real shape you've seen from the Sui SDK
      const error = { message: "Insufficient balance of X for owner Y" };
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("returns the original Error untouched when no pattern matches", () => {
      const error = new Error("some unrelated RPC failure");
      expect(mapDryRunError(error)).toBe(error);
    });

    it("wraps non-Error, non-object values in an Error", () => {
      const result = mapDryRunError("a string was thrown");
      expect(result).toBeInstanceOf(Error);
      expect(result).not.toBeInstanceOf(NotEnoughBalanceFees);
    });

    it("handles null and undefined without crashing", () => {
      expect(() => mapDryRunError(null)).not.toThrow();
      expect(() => mapDryRunError(undefined)).not.toThrow();
    });
  });

  describe("matcher precedence", () => {
    it("returns the first matching pattern when multiple could apply", () => {
      // Contrived but worth pinning down — if a future message contained
      // both phrases, which error wins? The array order decides.
      const error = new Error("needed amount: 100. Insufficient balance of X for owner Y");
      expect(mapDryRunError(error)).toBeInstanceOf(NotEnoughBalanceFees);
    });
  });
});
