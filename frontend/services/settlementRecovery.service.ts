import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { GroupService } from './group.service';
import { useAuthStore } from '@/stores/useAuthStore';

export type SettlementReference = { groupId: string; memberId: string; intentId: string };
type PendingSettlement = { reference: SettlementReference; sync: { receiverAddress: string; txHash: string; amount: string; rawAmountWei: string; assetSymbol: string; userNote?: string } };
const prefix = () => `atara.settlement.${process.env.EXPO_PUBLIC_NETWORK ?? 'base-sepolia'}.${useAuthStore.getState().user?.id ?? 'signed-out'}.`;
let replaying = false;
export async function queueSettlement(item: PendingSettlement) {
  if (!useAuthStore.getState().user) throw new Error('Session unavailable');
  await AsyncStorage.setItem(prefix() + item.sync.txHash.toLowerCase(), JSON.stringify(item));
}
export async function retryPendingSettlements() {
  if (!useAuthStore.getState().user) return { remaining: 0, settled: 0 };
  if (replaying) throw new Error('Une vérification est déjà en cours. Réessaie dans quelques instants.');
  replaying = true; let remaining = 0, settled = 0;
  const queuePrefix = prefix();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(queuePrefix));
    for (const key of keys) {
      if (prefix() !== queuePrefix) break;
      try {
        const raw = await AsyncStorage.getItem(key); if (!raw) continue;
        const item = JSON.parse(raw) as PendingSettlement;
        const response = await api.post('/transaction/sync', item.sync);
        const transactionId = response.data?.transaction?.id;
        if (!transactionId) throw new Error('Awaiting confirmation');
        await GroupService.settleByInternalTx(item.reference.groupId, item.reference.memberId, transactionId, item.reference.intentId);
        await AsyncStorage.removeItem(key); settled++;
      } catch { remaining++; }
    }
    return { remaining, settled };
  } finally { replaying = false; }
}
