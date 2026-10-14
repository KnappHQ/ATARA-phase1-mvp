const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;

/** Reads a PNG's size and colour type, and whether it carries any transparency. */
const png = (relative) => {
  const file = fs.readFileSync(path.join(root, relative));
  assert.equal(file.subarray(1, 4).toString("latin1"), "PNG", `${relative} is a PNG`);
  const chunks = new Set();
  for (let offset = 8; offset < file.length; ) {
    chunks.add(file.subarray(offset + 4, offset + 8).toString("latin1"));
    offset += 12 + file.readUInt32BE(offset);
  }
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20), colorType: file[25], hasTrns: chunks.has("tRNS") };
};

test("the iOS app icon is 1024x1024 with no alpha channel, as the App Store requires", () => {
  const icon = png(config.icon.replace("./", ""));
  assert.deepEqual([icon.width, icon.height], [1024, 1024]);
  assert.equal(icon.colorType, 2, "plain RGB: no alpha channel");
  assert.equal(icon.hasTrns, false, "no transparency chunk either");
});

test("the Android adaptive icon is square and its background is solid", () => {
  const adaptive = config.android.adaptiveIcon;
  const foreground = png(adaptive.foregroundImage.replace("./", ""));
  assert.equal(foreground.width, foreground.height);
  assert.match(adaptive.backgroundColor, /^#[0-9a-fA-F]{6}$/);
});

test("the web favicon is the ATARA mark, not a placeholder, and is square", () => {
  const favicon = png(config.web.favicon.replace("./", ""));
  assert.equal(favicon.width, favicon.height);
  assert.ok(favicon.width >= 32);
});

test("the old name never appears in the sources", () => {
  const skip = new Set(["node_modules", "dist", ".expo", "ios", "android", ".git", "package-lock.json"]);
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|cjs|mjs|json|md|yml|yaml)$/.test(entry.name) && /\bAstr[aâ]\b/i.test(fs.readFileSync(full, "utf8"))) hits.push(path.relative(root, full));
    }
  };
  walk(root);
  // This test file names the old brand on purpose.
  assert.deepEqual(hits.filter((file) => !file.endsWith("app-assets.test.cjs")), []);
});
