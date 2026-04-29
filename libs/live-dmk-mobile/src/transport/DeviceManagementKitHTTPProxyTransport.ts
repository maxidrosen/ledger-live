import {
  DeviceManagementKit,
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
import { httpProxyUrlSubject } from "./HttpProxyDmkTransport";
import { getDeviceManagementKit } from "../hooks/useDeviceManagementKit";

const HTTP_PROXY_TRANSPORT_IDENTIFIER = "HTTP_PROXY_TRANSPORT";

export class DeviceManagementKitHTTPProxyTransport extends Transport {
  readonly dmk: DeviceManagementKit;
  sessionId: string;
  private disconnectSubscription?: Subscription;

  private static activeUrl: string | null = null;
  private static activeSessionId: string | null = null;
  private static activeConnectPromise: Promise<string> | null = null;

  constructor(dmk: DeviceManagementKit, sessionId: string) {
    super();
    this.dmk = dmk;
    this.sessionId = sessionId;
    this.disconnectSubscription = this.listenToDisconnect();
  }

  static normalizeUrl(raw: string): string {
    return raw.replace(/^ws(s?):\/\//, "http$1://");
  }

  private static async ensureSession(dmk: DeviceManagementKit, url: string): Promise<string> {
    if (this.activeSessionId && this.activeUrl === url) return this.activeSessionId;
    if (this.activeConnectPromise) return this.activeConnectPromise;

    this.activeConnectPromise = (async () => {
      const devices = await firstValueFrom<DiscoveredDevice[]>(
        dmk.listenToAvailableDevices({ transport: HTTP_PROXY_TRANSPORT_IDENTIFIER }).pipe(
          filter(list => list.length > 0),
          timeout(10_000),
        ),
      );
      const sessionId = await dmk.connect({
        device: devices[0],
        sessionRefresherOptions: { isRefresherDisabled: true },
      });
      this.activeSessionId = sessionId;
      this.activeUrl = url;
      return sessionId;
    })();

    try {
      return await this.activeConnectPromise;
    } finally {
      this.activeConnectPromise = null;
    }
  }

  static async open(rawUrl: string): Promise<DeviceManagementKitHTTPProxyTransport> {
    const url = this.normalizeUrl(rawUrl);
    const dmk = getDeviceManagementKit();

    httpProxyUrlSubject.next(url);
    const sessionId = await this.ensureSession(dmk, url);

    return new DeviceManagementKitHTTPProxyTransport(dmk, sessionId);
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
      DeviceManagementKitHTTPProxyTransport.activeSessionId = null;
      DeviceManagementKitHTTPProxyTransport.activeUrl = null;
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
