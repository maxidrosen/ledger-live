import {
  DeviceManagementKit,
  DeviceManagementKitBuilder,
  DeviceStatus,
  SendApduEmptyResponseError,
  DeviceDisconnectedWhileSendingError,
  DeviceDisconnectedBeforeSendingApdu,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { DisconnectedDevice } from "@ledgerhq/errors";
import Transport from "@ledgerhq/hw-transport";
import { firstValueFrom, type Subscription } from "rxjs";
import { filter, timeout } from "rxjs/operators";
import { httpProxyTransportFactory } from "./HttpProxyDmkTransport";

type DmkEntry = {
  dmk: DeviceManagementKit;
  sessionId?: string;
  connectPromise?: Promise<void>;
};

export class DeviceManagementKitHTTPProxyTransport extends Transport {
  readonly dmk: DeviceManagementKit;
  sessionId: string;
  private readonly url: string;
  private disconnectSubscription?: Subscription;

  private static readonly byUrl = new Map<string, DmkEntry>();

  constructor(dmk: DeviceManagementKit, sessionId: string, url: string) {
    super();
    this.dmk = dmk;
    this.sessionId = sessionId;
    this.url = url;
    this.disconnectSubscription = this.listenToDisconnect();
  }

  static normalizeUrl(raw: string): string {
    return raw.replace(/^ws(s?):\/\//, "http$1://");
  }

  private static ensureEntry(url: string): DmkEntry {
    let entry = this.byUrl.get(url);
    if (!entry) {
      const dmk = new DeviceManagementKitBuilder()
        .addTransport(httpProxyTransportFactory(url))
        .build();
      entry = { dmk };
      this.byUrl.set(url, entry);
    }
    return entry;
  }

  private static async ensureSession(entry: DmkEntry): Promise<void> {
    if (entry.sessionId) return;
    if (entry.connectPromise) return entry.connectPromise;

    entry.connectPromise = (async () => {
      const devices = await firstValueFrom<DiscoveredDevice[]>(
        entry.dmk.listenToAvailableDevices({}).pipe(
          filter(list => list.length > 0),
          timeout(10_000),
        ),
      );
      entry.sessionId = await entry.dmk.connect({
        device: devices[0],
        sessionRefresherOptions: { isRefresherDisabled: true },
      });
    })();

    try {
      await entry.connectPromise;
    } finally {
      entry.connectPromise = undefined;
    }
  }

  static async open(rawUrl: string): Promise<DeviceManagementKitHTTPProxyTransport> {
    const url = this.normalizeUrl(rawUrl);
    const entry = this.ensureEntry(url);
    await this.ensureSession(entry);

    if (!entry.sessionId) {
      throw new Error(`Failed to establish DMK session with HTTP proxy at ${url}`);
    }

    return new DeviceManagementKitHTTPProxyTransport(entry.dmk, entry.sessionId, url);
  }

  async exchange(
    apdu: Buffer,
    { abortTimeoutMs }: { abortTimeoutMs?: number } = {},
  ): Promise<Buffer> {
    return this.dmk
      .sendApdu({
        sessionId: this.sessionId,
        apdu: new Uint8Array(apdu),
        abortTimeout: abortTimeoutMs,
      })
      .then(({ data, statusCode }) => Buffer.from([...data, ...statusCode]))
      .catch(error => {
        if (
          error instanceof SendApduEmptyResponseError ||
          error instanceof DeviceDisconnectedWhileSendingError ||
          error instanceof DeviceDisconnectedBeforeSendingApdu
        ) {
          throw new DisconnectedDevice();
        }
        throw error;
      });
  }

  close(): Promise<void> {
    this.disconnectSubscription?.unsubscribe();
    return Promise.resolve();
  }

  listenToDisconnect() {
    let isDisconnected = false;
    // Declared before subscribe() to avoid TDZ if the observable emits synchronously.
    let subscription: Subscription | undefined;
    const handleDisconnect = () => {
      if (isDisconnected) return;
      isDisconnected = true;
      const entry = DeviceManagementKitHTTPProxyTransport.byUrl.get(this.url);
      if (entry) entry.sessionId = undefined;
      this.emit("disconnect");
      subscription?.unsubscribe();
    };
    subscription = this.dmk.getDeviceSessionState({ sessionId: this.sessionId }).subscribe({
      next: (state: { deviceStatus: DeviceStatus }) => {
        if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) handleDisconnect();
      },
      error: handleDisconnect,
      complete: handleDisconnect,
    });
    return subscription;
  }

  static readonly isSupported = async () => true;
  static readonly list = async () => [];
  static readonly listen = (_observer: unknown) => ({ unsubscribe: () => {} });
}
