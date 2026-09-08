import { ethers } from "ethers";
import { ErrorHandler } from "../utils/errorHandler";

const ALCHEMY_WALLET_RPC_ORIGIN = "https://api.g.alchemy.com/v2";

type FetchLike = typeof fetch;

type SmartAccountOwnershipOptions = {
  apiKey?: string;
  fetchImpl?: FetchLike;
  accountTypes?: string[];
};

/**
 * Account types to try when deriving the expected smart account.
 *
 * A single hard-coded type rejects any user whose account was created with a
 * different one - a false negative that blocks registration and is hard to
 * diagnose. Override with SMART_ACCOUNT_TYPES (comma-separated) when the
 * deployment uses another type.
 */
export const DEFAULT_SMART_ACCOUNT_TYPES = ["sma-b"];

const configuredAccountTypes = (): string[] => {
  const configured = (process.env.SMART_ACCOUNT_TYPES || "")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_SMART_ACCOUNT_TYPES;
};

const normalizeAddress = (address: string, label: string): string => {
  try {
    return ethers.utils.getAddress(address).toLowerCase();
  } catch {
    throw new ErrorHandler(`Invalid ${label} address`, 400);
  }
};

export const resolveExpectedSmartAccountAddress = async (
  signerAddress: string,
  options: SmartAccountOwnershipOptions = {},
  accountType: string = configuredAccountTypes()[0],
): Promise<string> => {
  const normalizedSigner = normalizeAddress(signerAddress, "signer");
  const apiKey = options.apiKey ?? process.env.ALCHEMY_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) {
    throw new ErrorHandler(
      "Smart account verification is not configured on the server",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(
      `${ALCHEMY_WALLET_RPC_ORIGIN}/${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "wallet_requestAccount",
          params: [
            {
              signerAddress: normalizedSigner,
              creationHint: { accountType },
            },
          ],
        }),
      },
    );
  } catch {
    throw new ErrorHandler(
      "Unable to verify smart account ownership right now",
      503,
    );
  }

  if (!response.ok) {
    throw new ErrorHandler(
      "Unable to verify smart account ownership right now",
      503,
    );
  }

  let payload: {
    result?: { accountAddress?: string };
    error?: { message?: string };
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new ErrorHandler(
      "Invalid smart account verification response",
      503,
    );
  }

  if (payload.error || !payload.result?.accountAddress) {
    throw new ErrorHandler(
      payload.error?.message || "Unable to resolve smart account ownership",
      503,
    );
  }

  return normalizeAddress(payload.result.accountAddress, "smart account");
};

export const assertSmartAccountOwnedBySigner = async (
  signerAddress: string,
  smartAccountAddress: string,
  options: SmartAccountOwnershipOptions = {},
): Promise<void> => {
  const normalizedSmartAccount = normalizeAddress(
    smartAccountAddress,
    "smart account",
  );
  const accountTypes = options.accountTypes?.length
    ? options.accountTypes
    : configuredAccountTypes();

  // Accept as soon as one candidate type derives the claimed address; only
  // refuse once every candidate has been tried. An RPC failure still propagates
  // as a 503 from resolveExpectedSmartAccountAddress - unverifiable is never
  // treated as verified.
  for (const accountType of accountTypes) {
    const expectedSmartAccount = await resolveExpectedSmartAccountAddress(
      signerAddress,
      options,
      accountType,
    );

    if (normalizedSmartAccount === expectedSmartAccount) {
      return;
    }
  }

  throw new ErrorHandler(
    "Smart account does not belong to the authenticated wallet",
    400,
  );
};
