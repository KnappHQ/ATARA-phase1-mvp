// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

let getSentryExpoConfig;
try {
  getSentryExpoConfig =
    require("@sentry/react-native/metro").getSentryExpoConfig;
} catch (e) {
  // If @sentry/react-native isn't installed yet, fall back to the default config.
  getSentryExpoConfig = undefined;
}
const path = require("path");
const fs = require("fs");
const projectRoot = __dirname;

const ALIASES = {
  "@noble/hashes/crypto": path.resolve(
    projectRoot,
    "node_modules/@noble/hashes/crypto.js",
  ),
  "@sinclair/typebox": path.resolve(
    projectRoot,
    "node_modules/@sinclair/typebox/build/cjs/index.js",
  ),
};

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig
  ? getSentryExpoConfig(projectRoot)
  : getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...require("node-libs-react-native"),
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (ALIASES[moduleName]) {
    return {
      filePath: ALIASES[moduleName],
      type: "sourceFile",
    };
  }

  if (
    (moduleName.startsWith(".") || moduleName.startsWith("/")) &&
    (moduleName.endsWith(".js") || moduleName.endsWith(".jsx"))
  ) {
    const moduleFilePath = path.resolve(
      context.originModulePath,
      "..",
      moduleName,
    );

    if (!fs.existsSync(moduleFilePath)) {
      return context.resolveRequest(
        context,
        moduleName.replace(/\.[^/.]+$/, ""),
        platform,
      );
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  "browser",
  "require",
  "react-native",
];

module.exports = withNativeWind(config, { input: "./app/global.css" });
