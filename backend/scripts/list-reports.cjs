#!/usr/bin/env node
/**
 * Lists user reports for ATARA's team, newest first.
 *
 *   node scripts/list-reports.cjs              open reports
 *   node scripts/list-reports.cjs ALL          every report
 *   node scripts/list-reports.cjs REVIEWED     reviewed ones
 *   node scripts/list-reports.cjs done <id>    mark a report as reviewed
 *
 * Reads the database named by DATABASE_URL (on Render: the Shell tab of the API).
 * A report can also be read, and its status changed, over HTTP with the
 * x-admin-token header once SAFETY_ADMIN_TOKEN is set on the server:
 *   GET /api/v1/safety/admin/reports?status=OPEN
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || "reports-script";
const path = require("node:path");
try {
  require("ts-node/register");
} catch {
  // A production install has no ts-node: the compiled files are used instead.
}
const load = (name) => {
  try {
    return require(path.join(__dirname, "..", "dist", name));
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    return require(path.join(__dirname, "..", name.replace(/\.js$/, ".ts")));
  }
};

(async () => {
  const { safetyService } = load("services/safety.service.js");
  const prisma = load("config/prisma.js").default;
  const [first, second] = process.argv.slice(2);
  if (first === "done") {
    if (!second) throw new Error("Usage: list-reports.cjs done <reportId>");
    console.log(await safetyService.setReportStatus(second, "REVIEWED"));
  } else {
    const status = (first ?? "OPEN").toUpperCase();
    const reports = await safetyService.listReports(status, 200);
    if (!reports.length) console.log(`No ${status.toLowerCase()} reports.`);
    for (const report of reports) {
      console.log(
        [
          `${report.createdAt.toISOString()}  ${report.status}  ${report.reason}`,
          `  id       ${report.id}`,
          `  reported @${report.reportedHandle}`,
          `  reporter ${report.reporter?.handle ? `@${report.reporter.handle}` : "(deleted account)"}`,
          `  where    ${report.context ?? "unknown"}${report.contextId ? ` ${report.contextId}` : ""}`,
          `  details  ${report.details || "(none)"}`,
          "",
        ].join("\n"),
      );
    }
  }
  await prisma.$disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
