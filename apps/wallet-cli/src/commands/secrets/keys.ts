import { defineCommand } from "@bunli/core";
import { SecretsStore } from "../../secrets/secrets-store";
import { outputOption } from "../inputs";
import { createCommandOutput } from "../../output";

export default defineCommand({
  name: "keys",
  description: "List tracked domain keys from the local secrets store",
  options: {
    output: outputOption,
  },
  handler: async ({ flags }) => {
    const out = createCommandOutput(flags.output, { command: "secrets keys", network: "all" });
    await out.run(async () => {
      const store = await SecretsStore.read();
      if (!store) {
        throw new Error("Encryption CLI not initialized. Run `wallet-cli secrets init` first.");
      }
      out.secretsKeys(store.domains);
    });
  },
});
