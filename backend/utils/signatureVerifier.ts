import { ethers } from "ethers";
import { ErrorHandler } from "./errorHandler";

export type AuthPurpose = "login" | "register";

export type ParsedAuthMessage = {
  domain: string;
  chainId: number;
  wallet: string;
  purpose: AuthPurpose;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
};

export const verifySignature = (
  message: string,
  signature: string,
  claimedAddress: string,
): boolean => {
  try {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === claimedAddress.toLowerCase();
  } catch {
    return false;
  }
};

export const parseAuthMessage = (message: string): ParsedAuthMessage => {
  const lines = message.split("\n");
  if (lines.length !== 8 || lines[0] !== "ATARA authentication") {
    throw new ErrorHandler("Invalid authentication message", 401);
  }

  const read = (prefix: string, line: string) => {
    if (!line.startsWith(prefix)) {
      throw new ErrorHandler("Invalid authentication message", 401);
    }
    return line.slice(prefix.length);
  };

  const domain = read("Domain: ", lines[1]);
  const chainId = Number(read("Chain: ", lines[2]));
  const wallet = read("Wallet: ", lines[3]);
  const purposeText = read("Purpose: ", lines[4]).toLowerCase();
  const nonce = read("Nonce: ", lines[5]);
  const issuedAt = new Date(read("Issued At: ", lines[6]));
  const expiresAt = new Date(read("Expires At: ", lines[7]));

  if (
    !Number.isInteger(chainId) ||
    !ethers.utils.isAddress(wallet) ||
    !["login", "register"].includes(purposeText) ||
    !/^[a-f0-9]{64}$/.test(nonce) ||
    Number.isNaN(issuedAt.getTime()) ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= issuedAt
  ) {
    throw new ErrorHandler("Invalid authentication message", 401);
  }

  return {
    domain,
    chainId,
    wallet: wallet.toLowerCase(),
    purpose: purposeText as AuthPurpose,
    nonce,
    issuedAt,
    expiresAt,
  };
};

export const assertAuthMessageMatches = (input: {
  message: string;
  signerAddress: string;
  purpose: AuthPurpose;
  domain: string;
  chainId: number;
}) => {
  const parsed = parseAuthMessage(input.message);
  let normalizedSigner: string;
  try {
    normalizedSigner = ethers.utils.getAddress(input.signerAddress).toLowerCase();
  } catch {
    throw new ErrorHandler("Invalid signer address", 400);
  }

  if (
    parsed.domain !== input.domain ||
    parsed.chainId !== input.chainId ||
    parsed.wallet !== normalizedSigner ||
    parsed.purpose !== input.purpose
  ) {
    throw new ErrorHandler("Authentication challenge does not match", 401);
  }

  return parsed;
};
