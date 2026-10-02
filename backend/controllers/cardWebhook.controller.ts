import { Request, Response } from "express";
import { getCardProvider } from "../services/card/provider";
import { handleCardEvent } from "../services/card/cardEvents.service";
import { logError } from "../utils/logger";

/**
 * Card issuer events. The signature is checked over the raw bytes BEFORE
 * anything is parsed, and a provider that is not configured refuses everything:
 * an unsigned or unconfigured request never reaches the ledger.
 */
export const cardWebhookController = async (req: Request, res: Response) => {
  const provider = getCardProvider();
  if (provider.name !== req.params.provider || !provider.configured()) {
    return res.status(503).json({ success: false, message: "Card provider not available" });
  }
  const raw = req.body;
  if (!Buffer.isBuffer(raw) || !provider.verifyWebhook(raw, req.headers)) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Invalid body" });
  }
  try {
    const outcome = await handleCardEvent(provider, body);
    return res.status(200).json({ success: true, outcome });
  } catch (error) {
    // A 5xx makes the issuer retry, which is safe: handling is idempotent.
    logError("card-webhook-failed", error);
    return res.status(500).json({ success: false, message: "Could not process the event" });
  }
};
