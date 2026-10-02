import { settle, type Loaded } from "./loadState";
import type { CardStatusInfo, MyEntitlements, PlanInfo } from "@/services/subscription.service";

export interface EntitlementService {
  getPlans: () => Promise<{ plans: PlanInfo[]; milesPerSponsoredSend: number | null }>;
  getMine: () => Promise<MyEntitlements>;
  getCardStatus: () => Promise<CardStatusInfo>;
}

export type EntitlementPart =
  | { name: "plans"; result: Loaded<{ plans: PlanInfo[]; milesPerSponsoredSend: number | null }> }
  | { name: "mine"; result: Loaded<MyEntitlements> }
  | { name: "card"; result: Loaded<CardStatusInfo> };

/**
 * Loads the three things independently, each with its own deadline, and reports
 * each as it settles. A missing endpoint (an older service answers 404), a
 * refused session, a 500, no network, a timeout or a body that is not what was
 * expected is a value here, never an exception and never a wait without end.
 */
export const loadEntitlementParts = async (
  service: EntitlementService,
  onPart: (part: EntitlementPart) => void,
  deadlineMs = 12_000,
): Promise<void> => {
  await Promise.all([
    settle(() => service.getPlans(), deadlineMs).then((result) => onPart({ name: "plans", result })),
    settle(() => service.getMine(), deadlineMs).then((result) => onPart({ name: "mine", result })),
    settle(() => service.getCardStatus(), deadlineMs).then((result) => onPart({ name: "card", result })),
  ]);
};
