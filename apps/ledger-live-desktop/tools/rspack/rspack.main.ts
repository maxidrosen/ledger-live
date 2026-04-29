import path from "path";
import { rspack, type RspackOptions } from "@rspack/core";
import { commonConfig, rootFolder, outputFolder } from "./rspack.common";
import { buildMainEnv, buildDotEnvDefine, DOTENV_FILE } from "./utils";

/**
 * Creates the rspack configuration for the Electron main process
 */
export function createMainConfig(
  mode: "development" | "production",
  argv?: { port?: number },
): RspackOptions {
  const isDev = mode === "development";

  return {
    ...commonConfig,
    name: "main",
    mode,
    target: "electron-main",
    entry: {
      main: path.resolve(rootFolder, "src", "index.ts"),
    },
    output: {
      ...commonConfig.output,
      filename: "main.bundle.js",
      library: {
        type: "commonjs2",
      },
    },
    devtool: "source-map",
    externalsType: "commonjs2",
    externals: {
      // Prevent rspack from bundling the electron npm package (which returns the
      // binary path string). Leave require('electron') as a runtime call so
      // Electron's module system can resolve it to the actual API.
      electron: "commonjs2 electron",
    },
    resolve: {
      ...commonConfig.resolve,
      mainFields: ["main", "module"],
      alias: {
        ...commonConfig.resolve?.alias,
        // electron-is-dev@3.0.1 crashes at init time in the rspack bundle because
        // it calls require('electron') before Electron's app object is ready.
        // The dev server is always dev mode, so stub it with a simple true export.
        "electron-is-dev": path.resolve(__dirname, "./electron-is-dev-stub.js"),
      },
    },
    plugins: [
      new rspack.DefinePlugin({
        ...buildMainEnv(mode, argv),
        ...buildDotEnvDefine(DOTENV_FILE),
      }),
      new rspack.CopyRspackPlugin({
        patterns: [
          {
            from: path.join(rootFolder, "build", "icons"),
            to: path.join(outputFolder, "build", "icons"),
          },
        ],
      }),
    ],
    optimization: {
      minimize: !isDev,
    },
    stats: "errors-warnings",
  };
}

export default createMainConfig;
