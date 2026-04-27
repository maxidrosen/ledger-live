import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { resolve } from "node:path";
import { SecretsStore, trustchainFromMeta } from "../../secrets/secrets-store";
import { createLkrpSdk } from "../../secrets/lkrp-sdk";
import { deriveDomainKey, decryptData } from "../../secrets/crypto";
import { outputOption } from "../inputs";
import { createCommandOutput } from "../../output";

export default defineCommand({
  name: "decrypt",
  description: "Decrypt data with a domain-scoped AES-256-GCM key",
  options: {
    key: option(z.string().min(1), {
      description: "Domain name used to derive the scoped decryption key (e.g. openClaw-prod)",
      short: "k",
    }),
    input: option(z.string().optional(), {
      description: "Input file (default: stdin)",
      short: "i",
    }),
    output: option(z.string().optional(), {
      description: "Output file (default: stdout)",
      short: "o",
    }),
    format: outputOption,
  },
  handler: async ({ flags }) => {
    const out = createCommandOutput(flags.format, { command: "secrets decrypt", network: "all" });
    await out.run(async () => {
      const store = await SecretsStore.read();
      if (!store) {
        throw new Error("Encryption CLI not initialized. Run `wallet-cli secrets init` first.");
      }

      if (!flags.input && process.stdin.isTTY) {
        throw new Error("No input: provide --input FILE or pipe data to stdin.");
      }

      const sdk = createLkrpSdk();
      const fetchSpin = out.spin("Fetching encryption key from trustchain…");
      const restored = await sdk.restoreTrustchain(
        trustchainFromMeta(store.trustchain),
        store.memberCredentials,
      );
      fetchSpin?.success("Encryption key retrieved");

      const domainKey = await deriveDomainKey(restored.walletSyncEncryptionKey, flags.key);

      const ciphertext = new Uint8Array(
        flags.input ? await Bun.file(flags.input).arrayBuffer() : await Bun.stdin.arrayBuffer(),
      );
      const decSpin = out.spin(`Decrypting with domain "${flags.key}"…`);
      const plaintext = await decryptData(domainKey, ciphertext);
      decSpin?.success("Decrypted");

      if (flags.output) {
        const dest = resolve(flags.output);
        await Bun.write(dest, plaintext);
        out.secretsDecrypt({ dest });
      } else {
        process.stdout.write(Buffer.from(plaintext));
      }
    });
  },
});
