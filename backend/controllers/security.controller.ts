import { Request } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { securityService } from "../services/security.service";

const userId = (req: Request) => {
  if (!req.user?.id) throw new ErrorHandler("Not authorized", 401);
  return req.user.id as string;
};

export const securityController = {
  status: catchAsync(async (req, res) => {
    res.json({ success: true, security: await securityService.getStatus(userId(req)) });
  }),

  setupTotp: catchAsync(async (req, res) => {
    const label = typeof req.body?.label === "string" ? req.body.label : req.user?.handle;
    res.json({ success: true, setup: await securityService.beginTotpSetup(userId(req), label) });
  }),

  enableTotp: catchAsync(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (!code) throw new ErrorHandler("Authenticator code is required", 400);
    res.json({ success: true, security: await securityService.enableTotp(userId(req), code) });
  }),

  disableTotp: catchAsync(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (!code) throw new ErrorHandler("Authenticator code is required", 400);
    res.json({ success: true, security: await securityService.disableTotp(userId(req), code) });
  }),

  recoveryCodes: catchAsync(async (req, res) => {
    res.json({ success: true, codes: await securityService.regenerateRecoveryCodes(userId(req)) });
  }),

  verifyRecoveryCode: catchAsync(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (!code) throw new ErrorHandler("Recovery code is required", 400);
    const valid = await securityService.consumeRecoveryCode(userId(req), code);
    if (!valid) throw new ErrorHandler("Invalid or already used recovery code", 400);
    res.json({ success: true, valid: true });
  }),

  recoveryPhone: catchAsync(async (req, res) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone : "";
    if (!phone) throw new ErrorHandler("Phone number is required", 400);
    res.json({ success: true, recoveryPhone: await securityService.saveRecoveryPhone(userId(req), phone) });
  }),
};
