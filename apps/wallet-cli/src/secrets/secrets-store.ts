import { YAML } from "bun";
import { stateDir } from "@bunli/utils";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { unlink, chmod } from "node:fs/promises";
import { z } from "zod";
import type { MemberCredentials, Trustchain } from "@ledgerhq/ledger-key-ring-protocol/types";

const SECRETS_FILE = "secrets.yaml";

const MemberCredentialsSchema = z.object({
  pubkey: z.string(),
  privatekey: z.string(),
});

const TrustchainMetaSchema = z.object({
  rootId: z.string(),
  applicationPath: z.string(),
});

const DomainEntrySchema = z.object({
  domain: z.string(),
  firstUsed: z.string(),
});

const SecretsDataSchema = z.object({
  memberCredentials: MemberCredentialsSchema,
  trustchain: TrustchainMetaSchema,
  domains: z.array(DomainEntrySchema).default([]),
});

type TrustchainMeta = z.infer<typeof TrustchainMetaSchema>;
type DomainEntry = z.infer<typeof DomainEntrySchema>;

export function getSecretsPath(): string {
  return join(stateDir("ledger-wallet-cli"), SECRETS_FILE);
}

/** Build a full Trustchain object with empty walletSyncEncryptionKey (sufficient for auth-only calls). */
export function trustchainFromMeta(meta: TrustchainMeta): Trustchain {
  return { ...meta, walletSyncEncryptionKey: "" };
}

export class SecretsStore {
  private constructor(
    readonly memberCredentials: MemberCredentials,
    readonly trustchain: TrustchainMeta,
    private _domains: DomainEntry[],
  ) {}

  static async read(): Promise<SecretsStore | null> {
    let content: string;
    try {
      content = await Bun.file(getSecretsPath()).text();
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT")
        return null;
      throw err;
    }
    try {
      const parsed = SecretsDataSchema.parse(YAML.parse(content) ?? {});
      return new SecretsStore(parsed.memberCredentials, parsed.trustchain, parsed.domains);
    } catch {
      throw new Error(
        `Invalid secrets file at ${getSecretsPath()}. Run \`wallet-cli secrets destroy\` to reset.`,
      );
    }
  }

  static create(memberCredentials: MemberCredentials, trustchain: TrustchainMeta): SecretsStore {
    return new SecretsStore(memberCredentials, trustchain, []);
  }

  get domains(): ReadonlyArray<DomainEntry> {
    return this._domains;
  }

  trackDomain(domain: string): void {
    if (!this._domains.some(d => d.domain === domain)) {
      this._domains.push({ domain, firstUsed: new Date().toISOString() });
    }
  }

  addDomains(domainNames: string[]): void {
    for (const domain of domainNames) {
      this.trackDomain(domain);
    }
  }

  async write(): Promise<void> {
    const path = getSecretsPath();
    const dir = stateDir("ledger-wallet-cli");
    mkdirSync(dir, { recursive: true });
    await Bun.write(
      path,
      YAML.stringify({
        memberCredentials: this.memberCredentials,
        trustchain: this.trustchain,
        domains: this._domains,
      }),
    );
    await chmod(path, 0o600).catch(() => {
      // chmod is unsupported on some platforms (e.g. Windows) — best-effort only
    });
  }

  async wipe(): Promise<void> {
    try {
      await unlink(getSecretsPath());
    } catch {
      // Already gone — idempotent
    }
  }
}
