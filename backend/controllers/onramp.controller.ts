import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { createMoonPaySession } from "../services/onramp.service";
import { MOONPAY_CLIENT_IP_SOURCE } from "../utils/constants";
import { clientIpSource, describeIpSources, resolveClientIp } from "../utils/clientIp";

export const onrampController = {
  createSession: catchAsync(async (req: Request, res: Response) => {
    const walletAddress = req.user?.smartAccountAddress;
    if (!walletAddress) {
      throw new ErrorHandler(
        "Your smart account is not ready yet. Finish wallet setup first.",
        409,
      );
    }

    const baseCurrencyAmount = req.body?.baseCurrencyAmount;
    // The IP of the device asking for this URL, read from the trusted proxy chain
    // on this very request. Nothing the app sends (body, query, custom header) is used.
    const observed = resolveClientIp(req, clientIpSource(MOONPAY_CLIENT_IP_SOURCE));
    const session = createMoonPaySession({
      walletAddress,
      baseCurrencyAmount,
      clientIps: observed ? [observed.ip] : [],
    });

    res.status(200).json({ success: true, session });
  }),

  /**
   * The caller's own IP as each possible source reports it, to check the proxy
   * setup on Render before trusting a header (see docs/ONRAMP_AND_PAYMENTS.md).
   * Authenticated, never logged, and only ever about the caller's own request.
   */
  ipCheck: catchAsync(async (req: Request, res: Response) => {
    const source = clientIpSource(MOONPAY_CLIENT_IP_SOURCE);
    const observed = resolveClientIp(req, source);
    res.status(200).json({
      success: true,
      source,
      used: observed,
      sources: describeIpSources(req),
    });
  }),
};
