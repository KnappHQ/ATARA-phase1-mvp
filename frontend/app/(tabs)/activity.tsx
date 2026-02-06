import { useState, useMemo } from "react";
import { ScrollView, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SearchBar } from "@/components/activity/SearchBar";
import { Transaction } from "@/components/activity/TransactionItem";
import { ContactThread, ContactsTab } from "@/components/activity/ContactsTab";
import { TransactionsTab } from "@/components/activity/TransactionsTab";
import { TabSwitcher } from "@/components/activity/TabSwitcher";
import { COLORS } from "@/utils/constants";

type ActivityTab = "transactions" | "contacts";

// Dummy transaction data
const DUMMY_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    name: "Marcus Chen",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d89742",
    date: "Dec 16",
    time: "2:34 PM",
    amount: "+$1,038.00",
    type: "receive",
    note: "Dinner split 🍕",
  },
  {
    id: "2",
    name: "Marcus Chen",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d89742",
    date: "Dec 15",
    time: "11:20 AM",
    amount: "-$150.00",
    type: "send",
    note: "Coffee run ☕",
  },
  {
    id: "9",
    name: "Marcus Chen",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d89742",
    date: "Dec 10",
    time: "3:15 PM",
    amount: "+$320.00",
    type: "receive",
    note: "Concert tickets",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeCd8",
    date: "Dec 14",
    time: "4:15 PM",
    amount: "+$2,736.54",
    type: "receive",
    note: "Rent share",
  },
  {
    id: "6",
    name: "Elena Rodriguez",
    address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeCd8",
    date: "Dec 11",
    time: "3:30 PM",
    amount: "-$75.00",
    type: "send",
    note: "Groceries",
  },
  {
    id: "4",
    name: "James Wilson",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    date: "Dec 13",
    time: "9:00 AM",
    amount: "-$500.00",
    type: "send",
    note: "Equipment rental",
  },
  {
    id: "5",
    name: "Sarah Kim",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    date: "Dec 12",
    time: "6:45 PM",
    amount: "+$246.25",
    type: "receive",
    note: "Birthday gift 🎁",
  },
  {
    id: "7",
    name: "Alex Thompson",
    address: "0x6B175474E89094C44Da98b954EesfdA60F3F80C",
    date: "Dec 10",
    time: "12:00 PM",
    amount: "+$346.00",
    type: "receive",
    note: "Freelance payment",
  },
  {
    id: "8",
    name: "Ryan Park",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    date: "Dec 9",
    time: "8:22 PM",
    amount: "-$1,140.23",
    type: "send",
    note: "Trip expenses",
  },
];

export default function Activity() {
  const router = useRouter();
  const [activityTab, setActivityTab] = useState<ActivityTab>("transactions");
  const [searchQuery, setSearchQuery] = useState("");

  // Group transactions by contact address
  const contactThreads = useMemo(() => {
    const threads: Record<string, ContactThread> = {};

    DUMMY_TRANSACTIONS.forEach((tx) => {
      if (!threads[tx.address]) {
        threads[tx.address] = {
          address: tx.address,
          displayName: tx.name,
          lastMessage: "",
          lastNote: "",
          lastDate: tx.date,
          lastTime: tx.time,
          totalReceived: 0,
          totalSent: 0,
          transactionCount: 0,
          transactions: [],
        };
      }

      threads[tx.address].transactions.push(tx);
      threads[tx.address].transactionCount += 1;

      const amountNum = parseFloat(tx.amount.replace(/[^0-9.-]/g, ""));
      if (tx.type === "receive") {
        threads[tx.address].totalReceived += Math.abs(amountNum);
      } else {
        threads[tx.address].totalSent += Math.abs(amountNum);
      }
    });

    // Sort transactions and set last message
    Object.values(threads).forEach((thread) => {
      thread.transactions.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateB.getTime() - dateA.getTime();
      });

      const lastTx = thread.transactions[0];
      thread.lastMessage =
        lastTx.type === "receive"
          ? `Received ${lastTx.amount}`
          : `Sent ${lastTx.amount.replace("-", "")}`;
      thread.lastNote = lastTx.note || "";
      thread.lastDate = lastTx.date;
      thread.lastTime = lastTx.time;
    });

    return Object.values(threads).sort((a, b) => {
      const dateA = new Date(`${a.lastDate} ${a.lastTime}`);
      const dateB = new Date(`${b.lastDate} ${b.lastTime}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, []);

  // Filter transactions based on search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return DUMMY_TRANSACTIONS;
    const query = searchQuery.toLowerCase();
    return DUMMY_TRANSACTIONS.filter(
      (tx) =>
        tx.name.toLowerCase().includes(query) ||
        tx.note?.toLowerCase().includes(query) ||
        tx.amount.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // Filter contacts based on search query
  const filteredContactThreads = useMemo(() => {
    if (!searchQuery.trim()) return contactThreads;
    const query = searchQuery.toLowerCase();
    return contactThreads.filter(
      (thread) =>
        thread.displayName.toLowerCase().includes(query) ||
        thread.lastNote.toLowerCase().includes(query) ||
        thread.transactions.some((tx) =>
          tx.note?.toLowerCase().includes(query),
        ),
    );
  }, [contactThreads, searchQuery]);

  const handleThreadClick = (thread: ContactThread) => {
    router.push({
      pathname: "/contact-detail",
      params: {
        address: thread.address,
        displayName: thread.displayName,
        totalReceived: thread.totalReceived.toString(),
        totalSent: thread.totalSent.toString(),
        transactions: JSON.stringify(thread.transactions),
      },
    });
  };

  const handleTransactionClick = (tx: Transaction) => {
    router.push({
      pathname: "/transaction-detail",
      params: {
        id: tx.id,
        name: tx.name,
        address: tx.address,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        note: tx.note || "",
      },
    });
  };

  const handleTabChange = (tab: ActivityTab) => {
    setActivityTab(tab);
    setSearchQuery("");
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between mt-5 mb-4">
          <Text className="text-2xl font-semibold text-primary">Activity</Text>
        </View>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search @handle or note..."
        />

        <TabSwitcher activeTab={activityTab} onTabChange={handleTabChange} />

        {activityTab === "transactions" && (
          <TransactionsTab
            transactions={filteredTransactions}
            onTransactionClick={handleTransactionClick}
          />
        )}

        {activityTab === "contacts" && (
          <ContactsTab
            contactThreads={filteredContactThreads}
            onThreadClick={handleThreadClick}
          />
        )}

        <View className="h-24" />
      </ScrollView>
    </View>
  );
}
