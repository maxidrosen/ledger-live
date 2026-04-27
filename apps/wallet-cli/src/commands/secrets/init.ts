import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import os from "node:os";
import { SecretsStore } from "../../secrets/secrets-store";
import { createLkrpSdk } from "../../secrets/lkrp-sdk";
import { WALLET_CLI_DMK_DEVICE_ID } from "../../device/register-dmk-transport";
import { withLkrpDeviceSession } from "../../session/bridge-device-session";
import { MEMBER_NAME_MAX_LENGTH } from "../../secrets/constants";
import { spinner } from "../../shared/ui";
import { outputOption } from "../inputs";
import { createCommandOutput } from "../../output";

function defaultMemberName(): string {
  const raw = `${os.hostname()} (${os.platform()})`;
  return raw.slice(0, MEMBER_NAME_MAX_LENGTH);
}

export default defineCommand({
  name: "init",
  description: "Register this machine as a trustchain member (device required)",
  options: {
    name: option(z.string().min(1).max(MEMBER_NAME_MAX_LENGTH).optional(), {
      description: `Member name (default: hostname + platform, max ${MEMBER_NAME_MAX_LENGTH} chars)`,
      short: "n",
    }),
    output: outputOption,
  },
  handler: async ({ flags }) => {
    const out = createCommandOutput(flags.output, { command: "secrets init", network: "all" });
    await out.run(async () => {
      const existing = await SecretsStore.read();
      if (existing) {
        throw new Error(
          "Encryption CLI already initialized. Run `wallet-cli secrets destroy` to reset.",
        );
      }

      const memberName = flags.name ?? defaultMemberName();
      const sdk = createLkrpSdk(memberName);

      const credSpin = spinner("Generating member credentials…");
      const memberCredentials = await sdk.initMemberCredentials();
      credSpin.success("Member credentials created");

      const deviceSpin = spinner("Connect device, open Ledger Sync app — creating trustchain…");
      const { trustchain } = await withLkrpDeviceSession(() =>
        sdk.getOrCreateTrustchain(WALLET_CLI_DMK_DEVICE_ID, memberCredentials),
      );
      deviceSpin.success("Trustchain created");

      const store = SecretsStore.create(memberCredentials, {
        rootId: trustchain.rootId,
        applicationPath: trustchain.applicationPath,
      });
      await store.write();

      out.secretsInit({ memberName, rootId: trustchain.rootId });
    });
  },
});
