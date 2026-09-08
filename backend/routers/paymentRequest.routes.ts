import { Router } from "express";
import path from "path";
import QRCode from "qrcode";
import { rateLimit } from "express-rate-limit";
import { authentication } from "../middleware/auth.middleware";
import { catchAsync } from "../utils/catchAsync";
import { paymentRequestService as service, validateRequestToken } from "../services/paymentRequest.service";

const router = Router();
router.use((_req, res, next) => { res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" }); next(); });
router.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));
router.get("/client.js", (_req, res) => res.sendFile(path.resolve(__dirname, "../public/pay/client.js")));
router.get("/style.css", (_req, res) => res.sendFile(path.resolve(__dirname, "../public/pay/style.css")));
router.get("/pay/:token", catchAsync(async (req, res) => {
  validateRequestToken(req.params.token);
  res.sendFile(path.resolve(__dirname, "../public/pay/index.html"));
}));
router.post("/", authentication, catchAsync(async (req, res) => {
  res.status(201).json({ request: await service.create(req.user.id, req.body.amount, req.body.note ?? "") });
}));
router.delete("/:id", authentication, catchAsync(async (req, res) => {
  await service.cancel(req.params.id, req.user.id); res.json({ success: true });
}));
router.get("/:token/qr", catchAsync(async (req, res) => {
  const details = await service.publicDetails(req.params.token);
  // QR is rendered locally: no third-party service receives the request or address.
  res.type("svg").send(await QRCode.toString(details.uri, { type: "svg", margin: 2, errorCorrectionLevel: "M" }));
}));
router.get("/:token", catchAsync(async (req, res) => res.json(await service.publicDetails(req.params.token))));
router.post("/:token/confirm", catchAsync(async (req, res) => res.json(await service.confirm(req.params.token, req.body.txHash, req.body.payerAddress, req.body.signature))));
export default router;
