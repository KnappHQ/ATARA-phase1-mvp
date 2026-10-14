import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { safetyService } from "../services/safety.service";

export const safetyController = {
  block: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await safetyService.block(req.user.id, req.body?.handle);
    res.status(200).json({ success: true, ...result });
  }),

  unblock: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await safetyService.unblock(req.user.id, req.params.handle);
    res.status(200).json({ success: true, ...result });
  }),

  listBlocks: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const blocks = await safetyService.listBlocks(req.user.id);
    res.status(200).json({ success: true, blocks });
  }),

  report: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = await safetyService.report({ id: req.user.id, handle: req.user.handle }, req.body);
    res.status(201).json({ success: true, reportId: id });
  }),

  // Review tools for ATARA's own team. They exist only when SAFETY_ADMIN_TOKEN is
  // set on the server, and answer exactly like an unknown route otherwise.
  adminListReports: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    requireAdmin(req);
    const status = String(req.query.status ?? "OPEN").toUpperCase();
    if (!["OPEN", "REVIEWED", "ACTIONED", "ALL"].includes(status)) throw new ErrorHandler("Unknown status", 400);
    const limit = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const reports = await safetyService.listReports(status as any, Number.isFinite(limit) ? limit : 50);
    res.status(200).json({ success: true, reports });
  }),

  adminSetStatus: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    requireAdmin(req);
    const report = await safetyService.setReportStatus(req.params.id, req.body?.status);
    res.status(200).json({ success: true, report });
  }),
};

const requireAdmin = (req: Request) => {
  if (!safetyService.isAdminToken(req.headers["x-admin-token"])) throw new ErrorHandler("Not found", 404);
};
