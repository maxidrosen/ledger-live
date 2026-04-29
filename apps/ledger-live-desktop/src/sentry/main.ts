import type * as SentryType from "@sentry/electron/main";
import { Primitive } from "@sentry/types";
import { init, setShouldSendCallback } from "./install";

// @sentry/electron@5.2.0 calls electron.app.getAppPath() at module-load time,
// which crashes when the Electron app object isn't ready yet. Guard the require
// behind __SENTRY_URL__ so it's skipped entirely in dev builds.
let Sentry: typeof SentryType | null = null;
let available = false;
if (__SENTRY_URL__) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require("@sentry/electron/main");
    available = init(Sentry!);
  } catch (e) {
    console.warn("Sentry could not be initialized:", e);
  }
}

export default (shouldSendCallback: () => boolean, userId: string) => {
  if (!available || !Sentry) return;
  setShouldSendCallback(shouldSendCallback);
  Sentry.setUser({
    id: userId,
    ip_address: undefined,
  });
};
export const captureException = (e: Error) => {
  if (!Sentry) return;
  Sentry.captureException(e);
};
export const setTags = (tags: { [key: string]: Primitive }) => {
  if (!Sentry) return;
  Sentry.setTags(tags);
};
