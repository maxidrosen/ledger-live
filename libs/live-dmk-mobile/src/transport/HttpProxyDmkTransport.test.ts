import { ApduResponse, DeviceModelId, type TransportArgs } from "@ledgerhq/device-management-kit";
import { HttpProxyDmkTransport } from "./HttpProxyDmkTransport";

const HTTP_PROXY_TRANSPORT_IDENTIFIER = "HTTP_PROXY_TRANSPORT";

const mockDeviceModel = {
  model: DeviceModelId.NANO_X,
  name: "Nano X",
  id: DeviceModelId.NANO_X,
};

function createMockArgs(): TransportArgs {
  return {
    deviceModelDataSource: {
      getDeviceModel: jest.fn().mockReturnValue(mockDeviceModel),
    },
  } as unknown as TransportArgs;
}

describe("HttpProxyDmkTransport", () => {
  const url = "http://localhost:8435";
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("getIdentifier", () => {
    it("should return the HTTP proxy transport identifier", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      expect(transport.getIdentifier()).toBe(HTTP_PROXY_TRANSPORT_IDENTIFIER);
    });
  });

  describe("isSupported", () => {
    it("should always return true", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      expect(transport.isSupported()).toBe(true);
    });
  });

  describe("listenToAvailableDevices", () => {
    it("should emit a list containing the synthetic device", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      const emitted: unknown[][] = [];

      transport.listenToAvailableDevices().subscribe({ next: list => emitted.push(list) });

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toHaveLength(1);
      expect((emitted[0][0] as { id: string }).id).toBe(url);
    });

    it("should complete after emitting the synthetic device", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      let completed = false;

      transport.listenToAvailableDevices().subscribe({
        complete: () => {
          completed = true;
        },
      });

      expect(completed).toBe(true);
    });
  });

  describe("startDiscovering", () => {
    it("should emit the synthetic device", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      const discovered: unknown[] = [];

      transport.startDiscovering().subscribe({ next: d => discovered.push(d) });

      expect(discovered).toHaveLength(1);
      expect((discovered[0] as { id: string }).id).toBe(url);
      expect((discovered[0] as { transport: string }).transport).toBe(
        HTTP_PROXY_TRANSPORT_IDENTIFIER,
      );
    });
  });

  describe("stopDiscovering", () => {
    it("should not throw", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      expect(() => transport.stopDiscovering()).not.toThrow();
    });
  });

  describe("disconnect", () => {
    it("should return Right(undefined)", async () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      const result = await transport.disconnect();
      expect(result.isRight()).toBe(true);
      expect(result.unsafeCoerce()).toBeUndefined();
    });
  });

  describe("connect", () => {
    it("should return Right with a TransportConnectedDevice", async () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      const result = await transport.connect({ deviceId: url, onDisconnect: jest.fn() });
      expect(result.isRight()).toBe(true);
    });

    describe("sendApdu", () => {
      async function getSendApdu(urlOverride = url) {
        const transport = new HttpProxyDmkTransport(createMockArgs(), urlOverride);
        const result = await transport.connect({ deviceId: urlOverride, onDisconnect: jest.fn() });
        return result.unsafeCoerce().sendApdu;
      }

      it("should POST the APDU as hex to the proxy URL", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "9000" }),
        });

        await sendApdu(Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]));

        expect(global.fetch).toHaveBeenCalledWith(
          url,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ apduHex: "b001000000" }),
          }),
        );
      });

      it("should return Right(ApduResponse) with data and statusCode split correctly", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "deadbeef9000" }),
        });

        const result = await sendApdu(Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]));

        expect(result.isRight()).toBe(true);
        const response = result.unsafeCoerce() as ApduResponse;
        expect(Array.from(response.data)).toEqual([0xde, 0xad, 0xbe, 0xef]);
        expect(Array.from(response.statusCode)).toEqual([0x90, 0x00]);
      });

      it("should return Left when HTTP response is not ok", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

        const result = await sendApdu(Uint8Array.from([0x00]));

        expect(result.isLeft()).toBe(true);
      });

      it("should return Left when body contains an error field", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: "device busy" }),
        });

        const result = await sendApdu(Uint8Array.from([0x00]));

        expect(result.isLeft()).toBe(true);
      });

      it("should return Left when body.data is missing", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        const result = await sendApdu(Uint8Array.from([0x00]));

        expect(result.isLeft()).toBe(true);
      });

      it("should return Left when body.data is not valid hex", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "not-hex" }),
        });

        const result = await sendApdu(Uint8Array.from([0x00]));

        expect(result.isLeft()).toBe(true);
      });

      it("should return Left when the response is shorter than a status code", async () => {
        const sendApdu = await getSendApdu();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "90" }),
        });

        const result = await sendApdu(Uint8Array.from([0x00]));

        expect(result.isLeft()).toBe(true);
      });

      it("should return Left and NOT call onDisconnect when fetch throws", async () => {
        const transport = new HttpProxyDmkTransport(createMockArgs(), url);
        const onDisconnect = jest.fn();
        const connectResult = await transport.connect({ deviceId: url, onDisconnect });
        const sendApdu = connectResult.unsafeCoerce().sendApdu;

        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

        const result = await sendApdu(Uint8Array.from([0x00]));

        expect(result.isLeft()).toBe(true);
        expect(onDisconnect).not.toHaveBeenCalled();
      });
    });
  });

  describe("syntheticDevice", () => {
    it("should pass the custom deviceModelId to deviceModelDataSource.getDeviceModel", () => {
      const args = createMockArgs();
      const transport = new HttpProxyDmkTransport(args, url, DeviceModelId.FLEX);

      transport.listenToAvailableDevices().subscribe({ next: () => {} });

      expect(args.deviceModelDataSource.getDeviceModel).toHaveBeenCalledWith({
        id: DeviceModelId.FLEX,
      });
    });

    it("should default to NANO_X when no deviceModelId is provided", () => {
      const args = createMockArgs();
      const transport = new HttpProxyDmkTransport(args, url);

      transport.listenToAvailableDevices().subscribe({ next: () => {} });

      expect(args.deviceModelDataSource.getDeviceModel).toHaveBeenCalledWith({
        id: DeviceModelId.NANO_X,
      });
    });

    it("should include the URL in the device name", () => {
      const transport = new HttpProxyDmkTransport(createMockArgs(), url);
      const emitted: unknown[][] = [];

      transport.listenToAvailableDevices().subscribe({ next: list => emitted.push(list) });

      expect((emitted[0][0] as { name: string }).name).toContain(url);
    });
  });
});
