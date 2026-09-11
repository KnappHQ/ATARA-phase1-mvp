import express from "express";

const router = express.Router();
const APPLE_TEAM_ID = /^[A-Z0-9]{10}$/;
const ANDROID_SHA256 = /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/;

const unavailable = (res: express.Response, variable: string) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Retry-After", "300");
  return res.status(503).json({
    error: `Domain association is not configured: ${variable}`,
  });
};

router.get("/apple-app-site-association", (_req, res) => {
  const teamId = (process.env.APPLE_TEAM_ID || "").trim().toUpperCase();
  if (!APPLE_TEAM_ID.test(teamId)) return unavailable(res, "APPLE_TEAM_ID");

  const bundleId = (process.env.APPLE_BUNDLE_ID || "com.atara.app").trim();
  res.type("application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({
    webcredentials: {
      apps: [`${teamId}.${bundleId}`],
    },
  });
});

router.get("/assetlinks.json", (_req, res) => {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!fingerprints.length || fingerprints.some((value) => !ANDROID_SHA256.test(value))) {
    return unavailable(res, "ANDROID_SHA256_CERT_FINGERPRINTS");
  }

  const packageName = (process.env.ANDROID_PACKAGE_NAME || "com.atara.app").trim();
  res.type("application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json([
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
});

export default router;
