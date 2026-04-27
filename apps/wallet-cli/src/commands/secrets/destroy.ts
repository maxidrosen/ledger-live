import { defineCommand } from "@bunli/core";
import { createInterface } from "node:readline";
import { SecretsStore, trustchainFromMeta } from "../../secrets/secrets-store";
import { createLkrpSdk } from "../../secrets/lkrp-sdk";
import { spinner } from "../../shared/ui";
import { outputOption } from "../inputs";
import { createCommandOutput } from "../../output";

async function readConfirmation(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question('Type "destroy" to confirm: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export default defineCommand({
  name: "destroy",
  description: "Destroy the local trustchain membership and wipe credentials",
  options: {
    output: outputOption,
  },
  handler: async ({ flags }) => {
    const out = createCommandOutput(flags.output, { command: "secrets destroy", network: "all" });
    await out.run(async () => {
      const store = await SecretsStore.read();
      if (!store) {
        throw new Error("Nothing to destroy — encryption CLI is not initialized.");
      }

      const answer = await readConfirmation();
      if (answer !== "destroy") {
        process.stderr.write("Cancelled.\n");
        return;
      }

      const sdk = createLkrpSdk();
      const destroySpin = spinner("Destroying trustchain…");
      let remoteDestroySucceeded = false;
      try {
        await sdk.destroyTrustchain(trustchainFromMeta(store.trustchain), store.memberCredentials);
        remoteDestroySucceeded = true;
        destroySpin.success("Trustchain destroyed");
      } catch {
        destroySpin.error("Trustchain destroy failed (continuing with local wipe)");
      }

      await store.wipe();
      out.secretsDestroy(remoteDestroySucceeded);
    });
  },
});
