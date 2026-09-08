import fs from "node:fs";
import path from "node:path";

const owner = process.env.EXPO_OWNER?.trim();
const projectId = process.env.EAS_PROJECT_ID?.trim();

if (!owner) throw new Error("Set EXPO_OWNER to the ATARA-owned Expo account/organization slug.");
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(owner)) {
  throw new Error(`Invalid EXPO_OWNER: ${owner}`);
}
if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
  throw new Error("Set EAS_PROJECT_ID to the UUID of the ATARA-owned EAS project.");
}

const appPath = path.resolve("app.json");
const app = JSON.parse(fs.readFileSync(appPath, "utf8"));

if (app?.expo?.ios?.bundleIdentifier !== "com.atara.app") {
  throw new Error("Refusing to relink: unexpected iOS bundle identifier.");
}
if (app?.expo?.android?.package !== "com.atara.app") {
  throw new Error("Refusing to relink: unexpected Android package name.");
}

app.expo.owner = owner;
app.expo.extra ??= {};
app.expo.extra.eas ??= {};
app.expo.extra.eas.projectId = projectId;

fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");
console.log(JSON.stringify({
  ok: true,
  owner,
  projectId,
  slug: app.expo.slug,
  iosBundleIdentifier: app.expo.ios.bundleIdentifier,
  androidPackage: app.expo.android.package,
}, null, 2));
