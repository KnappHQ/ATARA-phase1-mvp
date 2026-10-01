/**
 * What the receipt says while a payment that was already accepted is being
 * confirmed. The person has moved on from the swipe, so this is the only place
 * that can tell them it is still going, or that it did not go through.
 */

export interface OutcomeLine {
  tone: "waiting" | "bad";
  title: string;
  body: string;
}

export const describeOutcome = (
  status: "pending" | "confirmed" | "failed",
  error?: string,
): OutcomeLine | null => {
  if (status === "confirmed") return null;
  if (status === "failed") {
    return {
      tone: "bad",
      title: "This payment did not go through",
      body: `${error ? `${error} ` : ""}No money was sent for it.`,
    };
  }
  // Pending with an error is the "may still go through" case, never "failed".
  if (error) {
    return {
      tone: "waiting",
      title: "Still being verified",
      body: "It may still go through. Check Activity before sending anything again.",
    };
  }
  return {
    tone: "waiting",
    title: "Sending…",
    body: "It is on its way. You can leave this screen; it keeps going.",
  };
};
