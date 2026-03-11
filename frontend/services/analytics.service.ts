import PostHog from "posthog-react-native";

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "",
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    disabled: false,
    persistence: "file",
    captureAppLifecycleEvents: true,
    flushAt: 20,
    flushInterval: 10000,
  },
);

export const analyticsIdentify = (
  distinctId: string,
  properties: {
    handle: string;
    email?: string;
    authProvider?: string;
    displayName?: string;
  },
) => {
  posthog.identify(distinctId, {
    handle: properties.handle,
    ...(properties.email !== undefined && { email: properties.email }),
    ...(properties.authProvider !== undefined && {
      auth_provider: properties.authProvider,
    }),
    ...(properties.displayName !== undefined && {
      display_name: properties.displayName,
    }),
  });
};

export const analyticsReset = () => {
  posthog.reset();
};

// expo-router + React Navigation v7 blocks PostHog autocapture — manual only
export const analyticsScreen = (pathname: string) => {
  posthog.screen(pathname);
};

export const analyticsEvents = {
  userSignedUp: (properties: { handle: string; authProvider: string }) => {
    posthog.capture("user signed up", {
      handle: properties.handle,
      auth_provider: properties.authProvider,
    });
  },

  transactionSent: (properties: {
    token: string;
    amountUsd: number;
    isInApp: boolean;
    hasNote: boolean;
    isSettlement: boolean;
  }) => {
    posthog.capture("transaction sent", {
      token: properties.token,
      amount_usd: properties.amountUsd,
      is_in_app: properties.isInApp,
      has_note: properties.hasNote,
      is_settlement: properties.isSettlement,
    });
  },

  transactionFailed: (properties: { token: string; errorMessage: string }) => {
    posthog.capture("transaction send failed", {
      token: properties.token,
      error_message: properties.errorMessage,
    });
  },

  groupCreated: (properties: { memberCount: number }) => {
    posthog.capture("group created", {
      member_count: properties.memberCount,
    });
  },

  groupSettled: (properties: { settleType: "on_chain" | "manual" }) => {
    posthog.capture("group settled", {
      settle_type: properties.settleType,
    });
  },
};
