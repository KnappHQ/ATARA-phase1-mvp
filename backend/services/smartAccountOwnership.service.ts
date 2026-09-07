import { ethers } from "ethers";
import { ErrorHandler } from "../utils/errorHandler";

const ALCHEMY_WALLET_RPC_ORIGIN = "https://api.g.alchemy.com/v2";

type FetchLike = typeof fetch;

type SmartAccountOwnershipOptions = {
  apiKey?: string;
  fetchImpl?: FetchLike;
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
              creationHint: { accountType: "sma-b" },
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
  const expectedSmartAccount = await resolveExpectedSmartAccountAddress(
    signerAddress,
    options,
  );

  if (normalizedSmartAccount !== expectedSmartAccount) {
    throw new ErrorHandler(
      "Smart account does not belong to the authenticated wallet",
      400,
    );
  }
};
