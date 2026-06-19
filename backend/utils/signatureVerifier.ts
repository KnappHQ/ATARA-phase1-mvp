import { ethers } from "ethers";
import { ErrorHandler } from "./errorHandler";

/**
 * Verify that a message was signed by the claimed address
 * @param message - The message that was signed
 * @param signature - The signature to verify
 * @param claimedAddress - The address that should have signed the message
 * @returns true if signature is valid, false otherwise
 */
export const verifySignature = (
  message: string,
  signature: string,
  claimedAddress: string,
): boolean => {
  try {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === claimedAddress.toLowerCase();
  } catch (error) {
    return false;
  }
};

/**
 * Extract and validate timestamp from login message
 * Ensures the message is recent (not older than 5 minutes)
 * @param message - The login message
 * @returns timestamp in milliseconds if valid, throws error otherwise
 */
export const validateMessageTimestamp = (message: string): number => {
  const timestampMatch = message.match(/Timestamp: (\d+)/);

  if (!timestampMatch || !timestampMatch[1]) {
    throw new ErrorHandler("Invalid message format - missing timestamp", 400);
  }

  const messageTimestamp = parseInt(timestampMatch[1], 10);
  const currentTime = Date.now();
  const fiveMinutesInMs = 5 * 60 * 1000;

  // Check if message is too old
  if (currentTime - messageTimestamp > fiveMinutesInMs) {
    throw new ErrorHandler("Login message expired. Please try again.", 401);
  }

  // Check if message is from the future (clock skew tolerance: 1 minute)
  const oneMinuteInMs = 60 * 1000;
  if (messageTimestamp - currentTime > oneMinuteInMs) {
    throw new ErrorHandler("Invalid message timestamp", 400);
  }

  return messageTimestamp;
};

/**
 * Complete login verification flow
 * @param signerAddress - The wallet address attempting login
 * @param message - The message that should have been signed
 * @param signature - The signature to verify
 * @throws ErrorHandler if verification fails
 */
export const verifyLoginSignature = (
  signerAddress: string,
  message: string,
  signature: string,
): void => {
  // Validate message format and timestamp
  validateMessageTimestamp(message);

  // Verify signature matches the claimed address
  if (!signature || !verifySignature(message, signature, signerAddress)) {
    throw new ErrorHandler(
      "Invalid signature. Please sign with your wallet.",
      401,
    );
  }
};
