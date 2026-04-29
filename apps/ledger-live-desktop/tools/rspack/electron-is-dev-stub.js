// Stub for electron-is-dev in the rspack main process bundle.
// electron-is-dev@3.0.1 calls require('electron') at module init time before
// the Electron app object is ready, causing a crash in the dev bundle.
// pnpm dev:lld is always development mode, so exporting true is correct.
module.exports = true;
module.exports.default = true;
