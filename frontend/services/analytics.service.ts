import PostHog from "posthog-react-native";

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "",
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    disabled: true, // Pilot metrics are collected by consent in feedback; no passive tracking.
    persistence: "file",
    captureAppLifecycleEvents: false,
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
  // Never send account identifiers or contact details to analytics.

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
      is_in_app: properties.isInApp,
      has_note: properties.hasNote,
      is_settlement: properties.isSettlement,
    });
  },

  transactionFailed: (properties: { token: string; errorMessage: string }) => {
    posthog.capture("transaction send failed", {
      token: properties.token,
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
