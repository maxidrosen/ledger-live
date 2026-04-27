import { Observable, of } from "rxjs";
import { Either, Left, Right } from "purify-ts";
import {
  ApduResponse,
  DeviceModelId,
  TransportConnectedDevice,
  UnknownDeviceError,
  bufferToHexaString,
  hexaStringToBuffer,
  type ConnectError,
  type DmkError,
  type Transport as DmkTransport,
  type TransportArgs,
  type TransportDiscoveredDevice,
  type TransportFactory,
} from "@ledgerhq/device-management-kit";

const HTTP_PROXY_TRANSPORT_IDENTIFIER = "HTTP_PROXY_TRANSPORT";

export class HttpProxyDmkTransport implements DmkTransport {
  private readonly url: string;
  private readonly deviceModelId: DeviceModelId;
  private readonly args: TransportArgs;

  constructor(
    args: TransportArgs,
    url: string,
    deviceModelId: DeviceModelId = DeviceModelId.NANO_X,
  ) {
    this.args = args;
    this.url = url;
    this.deviceModelId = deviceModelId;
  }

  getIdentifier(): string {
    return HTTP_PROXY_TRANSPORT_IDENTIFIER;
  }

  isSupported(): boolean {
    return true;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    return of([this.syntheticDevice()]);
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    return of(this.syntheticDevice());
  }

  stopDiscovering(): void {
    // No-op — the synthetic device is always available, nothing to tear down.
  }

  async connect({
    deviceId,
  }: {
    deviceId: string;
    onDisconnect: (deviceId: string) => void;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const url = this.url;

    const sendApdu = async (apdu: Uint8Array): Promise<Either<DmkError, ApduResponse>> => {
      try {
        const apduHex = bufferToHexaString(apdu, false);
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ apduHex }),
        });
        if (!resp.ok) {
          return Left(new UnknownDeviceError(`HTTP ${resp.status}`));
        }
        const body = (await resp.json()) as { data?: string; error?: unknown };
        if (body.error) {
          // Avoid String() coercion which yields "[object Object]" for non-string errors.
          const message =
            typeof body.error === "string"
              ? body.error
              : body.error instanceof Error
                ? body.error.message
                : JSON.stringify(body.error);
          return Left(new UnknownDeviceError(message));
        }
        if (!body.data) {
          return Left(new UnknownDeviceError("empty response from proxy"));
        }
        const bytes = hexaStringToBuffer(body.data);
        if (!bytes) {
          return Left(new UnknownDeviceError(`invalid hex in proxy response: ${body.data}`));
        }
        // APDU response must include the 2-byte status code.
        if (bytes.length < 2) {
          return Left(new UnknownDeviceError(`malformed proxy response: ${body.data}`));
        }
        return Right(
          new ApduResponse({
            data: bytes.slice(0, -2),
            statusCode: bytes.slice(-2),
          }),
        );
      } catch (err) {
        // Do NOT invoke DMK's onDisconnect — it signals physical disconnect and wipes
        // the session from the registry. A failed HTTP request should be retryable.
        const message = err instanceof Error ? err.message : String(err);
        return Left(new UnknownDeviceError(message));
      }
    };

    const connectedDevice = new TransportConnectedDevice({
      id: deviceId,
      deviceModel: this.args.deviceModelDataSource.getDeviceModel({ id: this.deviceModelId }),
      type: "USB",
      transport: HTTP_PROXY_TRANSPORT_IDENTIFIER,
      sendApdu,
    });

    return Right(connectedDevice);
  }

  async disconnect(): Promise<Either<DmkError, void>> {
    return Right(undefined);
  }

  private syntheticDevice(): TransportDiscoveredDevice {
    return {
      id: this.url,
      deviceModel: this.args.deviceModelDataSource.getDeviceModel({ id: this.deviceModelId }),
      transport: HTTP_PROXY_TRANSPORT_IDENTIFIER,
      name: `HTTP Proxy (${this.url})`,
    };
  }
}

export const httpProxyTransportFactory =
  (url: string, deviceModelId?: DeviceModelId): TransportFactory =>
  (args: TransportArgs) =>
    new HttpProxyDmkTransport(args, url, deviceModelId);
