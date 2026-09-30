import { useCallback, useEffect, useState } from "react";

import { getPaymentOperations } from "@/services/paymentOperations.runtime";
import type { UnsettledAccount } from "@/utils/unsettledPayments";

/** Payments still unsettled on this phone, by wallet address (lower case). */
export const useUnsettledPayments = () => {
  const [byAccount, setByAccount] = useState<Record<string, UnsettledAccount>>({});
  const refresh = useCallback(async () => {
    try {
      const items = await getPaymentOperations().unsettled();
      setByAccount(Object.fromEntries(items.map((item) => [item.account, item])));
    } catch {
      // A warning that cannot be computed is simply not shown; nothing depends on it.
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { byAccount, refresh };
};
