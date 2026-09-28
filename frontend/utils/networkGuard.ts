/**
 * Before a payment, the app asks the ATARA service which network it runs on.
 * The check exists to stop one specific accident: an app built for one network
 * paired with a service on another, where a transfer could land somewhere the
 * service never records.
 *
 * It must not become a switch that turns payments off. The transfer is signed
 * on this phone and submitted to the chain; ATARA's service is not in that path.
 * So only a service that answers AND names a different network blocks the
 * payment. A service that is down, slow or answers without a network is
 * "unknown", and the owner can still move their money.
 */
export type ServiceNetwork = "match" | "mismatch" | "unknown";

export const assessServiceNetwork = (
  reportedChainId: unknown,
  expectedChainId: number,
): ServiceNetwork => {
  if (typeof reportedChainId !== "number" || !Number.isFinite(reportedChainId)) {
    return "unknown";
  }
  return reportedChainId === expectedChainId ? "match" : "mismatch";
};
