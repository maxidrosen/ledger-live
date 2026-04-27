import { BehaviorSubject, Observable, Subject } from "rxjs";
import {
  DeviceManagementKit,
  DeviceManagementKitBuilder,
  DeviceModelId as DMKDeviceModelId,
  DeviceSessionState,
  DeviceSessionStateType,
  DeviceStatus,
  DiscoveredDevice,
  SendApduEmptyResponseError,
  DeviceDisconnectedBeforeSendingApdu,
  DeviceDisconnectedWhileSendingError,
} from "@ledgerhq/device-management-kit";
import { DisconnectedDevice } from "@ledgerhq/errors";
import { DeviceManagementKitHTTPProxyTransport } from "./DeviceManagementKitHTTPProxyTransport";

jest.mock("@ledgerhq/device-management-kit", () => ({
  ...jest.requireActual("@ledgerhq/device-management-kit"),
  DeviceManagementKitBuilder: jest.fn(),
}));

jest.mock("./HttpProxyDmkTransport", () => ({
  httpProxyTransportFactory: jest.fn().mockReturnValue(jest.fn()),
}));

const aMockedDeviceSessionState: DeviceSessionState = {
  deviceStatus: DeviceStatus.CONNECTED,
  sessionStateType: DeviceSessionStateType.Connected,
  deviceModelId: DMKDeviceModelId.FLEX,
};

const mockDiscoveredDevice: DiscoveredDevice = {
  id: "http://localhost:8435",
  name: "HTTP Proxy",
  deviceModel: {
    model: DMKDeviceModelId.NANO_X,
    name: "Nano X",
    id: DMKDeviceModelId.NANO_X,
  },
  transport: "HTTP_PROXY_TRANSPORT",
};

function createMockDMK(): DeviceManagementKit {
  return {
    getDeviceSessionState: jest.fn(),
    listenToAvailableDevices: jest.fn(),
    connect: jest.fn(),
    sendApdu: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as DeviceManagementKit;
}

describe("DeviceManagementKitHTTPProxyTransport", () => {
  let mockDmk: DeviceManagementKit;

  beforeEach(() => {
    jest.restoreAllMocks();
    (
      DeviceManagementKitHTTPProxyTransport as unknown as { byUrl: Map<string, unknown> }
    ).byUrl.clear();

    mockDmk = createMockDMK();

    jest.mocked(DeviceManagementKitBuilder).mockImplementation(
      () =>
        ({
          addTransport: jest.fn().mockReturnThis(),
          build: jest.fn().mockReturnValue(mockDmk),
        }) as unknown as DeviceManagementKitBuilder,
    );
  });

  describe("normalizeUrl", () => {
    it("should convert ws:// to http://", () => {
      expect(DeviceManagementKitHTTPProxyTransport.normalizeUrl("ws://localhost:8435")).toBe(
        "http://localhost:8435",
      );
    });

    it("should convert wss:// to https://", () => {
      expect(DeviceManagementKitHTTPProxyTransport.normalizeUrl("wss://example.com")).toBe(
        "https://example.com",
      );
    });

    it("should leave http:// URLs unchanged", () => {
      expect(DeviceManagementKitHTTPProxyTransport.normalizeUrl("http://localhost:8435")).toBe(
        "http://localhost:8435",
      );
    });

    it("should leave https:// URLs unchanged", () => {
      expect(DeviceManagementKitHTTPProxyTransport.normalizeUrl("https://example.com")).toBe(
        "https://example.com",
      );
    });
  });

  describe("open", () => {
    beforeEach(() => {
      jest.mocked(mockDmk.getDeviceSessionState).mockReturnValue(new Observable());
      jest.mocked(mockDmk.listenToAvailableDevices).mockReturnValue(
        new Observable(subscriber => {
          subscriber.next([mockDiscoveredDevice]);
        }),
      );
      jest.mocked(mockDmk.connect).mockResolvedValue("sessionId");
    });

    it("should create a DMK session and return a transport with dmk and sessionId", async () => {
      // when
      const transport = await DeviceManagementKitHTTPProxyTransport.open("http://localhost:8435");

      // then
      expect(transport).toBeInstanceOf(DeviceManagementKitHTTPProxyTransport);
      expect(transport.dmk).toBe(mockDmk);
      expect(transport.sessionId).toBe("sessionId");
    });

    it("should normalize ws:// URL before connecting", async () => {
      // when
      const transport = await DeviceManagementKitHTTPProxyTransport.open("ws://localhost:8435");

      // then
      expect(transport.sessionId).toBe("sessionId");
    });

    it("should call connect with the discovered device and isRefresherDisabled", async () => {
      // when
      await DeviceManagementKitHTTPProxyTransport.open("http://localhost:8435");

      // then
      expect(mockDmk.connect).toHaveBeenCalledWith({
        device: mockDiscoveredDevice,
        sessionRefresherOptions: { isRefresherDisabled: true },
      });
    });

    it("should reuse the existing session for the same URL", async () => {
      // given
      await DeviceManagementKitHTTPProxyTransport.open("http://localhost:8435");

      // when — second open call
      await DeviceManagementKitHTTPProxyTransport.open("http://localhost:8435");

      // then — DMK connect called only once
      expect(mockDmk.connect).toHaveBeenCalledTimes(1);
    });

    it("should create a new session when the previous one was cleared by disconnect", async () => {
      // given — first open, then simulate disconnect clearing the session
      const firstTransport =
        await DeviceManagementKitHTTPProxyTransport.open("http://localhost:8435");
      // Simulate what listenToDisconnect does when NOT_CONNECTED fires
      const entry = (
        DeviceManagementKitHTTPProxyTransport as unknown as {
          byUrl: Map<string, { sessionId?: string }>;
        }
      ).byUrl.get("http://localhost:8435");
      if (entry) entry.sessionId = undefined;

      jest.mocked(mockDmk.connect).mockResolvedValue("sessionId2");

      // when
      const secondTransport =
        await DeviceManagementKitHTTPProxyTransport.open("http://localhost:8435");

      // then
      expect(secondTransport.sessionId).toBe("sessionId2");
      expect(mockDmk.connect).toHaveBeenCalledTimes(2);
      expect(firstTransport.sessionId).toBe("sessionId");
    });
  });

  describe("close", () => {
    it("should resolve without error", async () => {
      // given
      jest.mocked(mockDmk.getDeviceSessionState).mockReturnValue(new Observable());
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );

      // when / then
      await expect(transport.close()).resolves.toBeUndefined();
    });

    it("should unsubscribe from the device session state observable", async () => {
      // given
      const deviceSessionStateSubject = new Subject<DeviceSessionState>();
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );
      const emitSpy = jest.spyOn(transport, "emit");

      // when
      await transport.close();
      deviceSessionStateSubject.next({
        ...aMockedDeviceSessionState,
        deviceStatus: DeviceStatus.NOT_CONNECTED,
      });

      // then — emissions after close() must not trigger disconnect
      expect(emitSpy).not.toHaveBeenCalledWith("disconnect");
    });
  });

  describe("exchange", () => {
    it("should call dmk.sendApdu and return the combined data+statusCode buffer", async () => {
      // given
      jest.mocked(mockDmk.getDeviceSessionState).mockReturnValue(new Observable());
      jest.mocked(mockDmk.sendApdu).mockResolvedValue({
        data: Uint8Array.from([0x42, 0x21, 0x34]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      });
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );
      const abortTimeoutMs = 42;

      // when
      const response = await transport.exchange(Buffer.from([0xb0, 0x01, 0x00, 0x00, 0x00]), {
        abortTimeoutMs,
      });

      // then
      expect(mockDmk.sendApdu).toHaveBeenCalledWith({
        sessionId: "session",
        apdu: Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]),
        abortTimeout: abortTimeoutMs,
      });
      expect(response).toEqual(Buffer.from([0x42, 0x21, 0x34, 0x90, 0x00]));
    });

    it("should re-throw unknown errors", async () => {
      // given
      jest.mocked(mockDmk.getDeviceSessionState).mockReturnValue(new Observable());
      jest.mocked(mockDmk.sendApdu).mockRejectedValue(new Error("unknown error"));
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );

      // when / then
      await expect(transport.exchange(Buffer.from([0x00]))).rejects.toThrow("unknown error");
    });

    [
      new SendApduEmptyResponseError(),
      new DeviceDisconnectedWhileSendingError(),
      new DeviceDisconnectedBeforeSendingApdu(),
    ].forEach(error => {
      it(`should remap ${error.constructor.name} to DisconnectedDevice`, async () => {
        // given
        jest.mocked(mockDmk.getDeviceSessionState).mockReturnValue(new Observable());
        jest.mocked(mockDmk.sendApdu).mockRejectedValue(error);
        const transport = new DeviceManagementKitHTTPProxyTransport(
          mockDmk,
          "session",
          "http://localhost:8435",
        );

        // when
        let caughtError: unknown;
        await transport.exchange(Buffer.from([0x00])).catch(e => {
          caughtError = e;
        });

        // then
        expect(caughtError).toEqual(new DisconnectedDevice());
      });
    });
  });

  describe("listenToDisconnect", () => {
    it("should be called on new transport", () => {
      // given
      jest.mocked(mockDmk.getDeviceSessionState).mockReturnValue(new Observable());
      jest.spyOn(DeviceManagementKitHTTPProxyTransport.prototype, "listenToDisconnect");

      // when
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );

      // then
      expect(transport.listenToDisconnect).toHaveBeenCalled();
    });

    it("should clear byUrl entry sessionId and emit disconnect on NOT_CONNECTED", () => {
      // given
      const deviceSessionStateSubject = new Subject<DeviceSessionState>();
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());
      const url = "http://localhost:8435";
      const entry = { dmk: mockDmk, sessionId: "session" };
      (
        DeviceManagementKitHTTPProxyTransport as unknown as { byUrl: Map<string, unknown> }
      ).byUrl.set(url, entry);
      const transport = new DeviceManagementKitHTTPProxyTransport(mockDmk, "session", url);
      jest.spyOn(transport, "emit");

      // when
      deviceSessionStateSubject.next({
        ...aMockedDeviceSessionState,
        deviceStatus: DeviceStatus.NOT_CONNECTED,
      });

      // then
      expect(entry.sessionId).toBeUndefined();
      expect(transport.emit).toHaveBeenCalledWith("disconnect");
    });

    it("should not emit disconnect for non-NOT_CONNECTED states", () => {
      // given
      const deviceSessionStateSubject = new Subject<DeviceSessionState>();
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );
      jest.spyOn(transport, "emit");

      // when
      deviceSessionStateSubject.next({
        ...aMockedDeviceSessionState,
        deviceStatus: DeviceStatus.BUSY,
      });

      // then
      expect(transport.emit).not.toHaveBeenCalled();
    });

    it("should emit disconnect when the state observable completes", () => {
      // given
      const deviceSessionStateSubject = new Subject<DeviceSessionState>();
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );
      jest.spyOn(transport, "emit");

      // when
      deviceSessionStateSubject.complete();

      // then
      expect(transport.emit).toHaveBeenCalledWith("disconnect");
    });

    it("should emit disconnect when the state observable errors", () => {
      // given
      const deviceSessionStateSubject = new Subject<DeviceSessionState>();
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );
      jest.spyOn(transport, "emit");

      // when
      deviceSessionStateSubject.error(new Error("state error"));

      // then
      expect(transport.emit).toHaveBeenCalledWith("disconnect");
    });

    it("should not throw when the observable emits NOT_CONNECTED synchronously on subscribe", () => {
      const deviceSessionStateSubject = new BehaviorSubject<DeviceSessionState>({
        ...aMockedDeviceSessionState,
        deviceStatus: DeviceStatus.NOT_CONNECTED,
      });
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());

      expect(
        () =>
          new DeviceManagementKitHTTPProxyTransport(mockDmk, "session", "http://localhost:8435"),
      ).not.toThrow();
    });

    it("should emit disconnect only once even if NOT_CONNECTED fires multiple times", () => {
      // given
      const deviceSessionStateSubject = new Subject<DeviceSessionState>();
      jest
        .mocked(mockDmk.getDeviceSessionState)
        .mockReturnValue(deviceSessionStateSubject.asObservable());
      const transport = new DeviceManagementKitHTTPProxyTransport(
        mockDmk,
        "session",
        "http://localhost:8435",
      );
      const emitSpy = jest.spyOn(transport, "emit");

      // when
      deviceSessionStateSubject.next({
        ...aMockedDeviceSessionState,
        deviceStatus: DeviceStatus.NOT_CONNECTED,
      });
      deviceSessionStateSubject.next({
        ...aMockedDeviceSessionState,
        deviceStatus: DeviceStatus.NOT_CONNECTED,
      });

      // then — handler is idempotent and unsubscribes after first disconnect
      expect(emitSpy.mock.calls.filter(c => c[0] === "disconnect")).toHaveLength(1);
    });
  });
});
