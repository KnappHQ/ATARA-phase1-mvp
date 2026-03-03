import { View, Text, Pressable } from "react-native";
import { COLORS } from "@/utils/constants";

export type ActivityTab = "transactions" | "contacts" | "groups";

interface TabSwitcherProps {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}

export function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <View className="flex-row gap-2 mb-5">
      <Pressable
        onPress={() => onTabChange("transactions")}
        className="flex-1 py-3 rounded-2xl active:opacity-80"
        style={{
          backgroundColor:
            activeTab === "transactions"
              ? COLORS.accent
              : "rgba(255, 255, 255, 0.05)",
          borderWidth: activeTab === "transactions" ? 0 : 1,
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        <Text
          className="font-mono text-base text-center"
          style={{
            color:
              activeTab === "transactions"
                ? COLORS.white
                : "rgba(255, 255, 255, 0.6)",
          }}
        >
          Transactions
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("contacts")}
        className="flex-1 py-3 rounded-2xl active:opacity-80"
        style={{
          backgroundColor:
            activeTab === "contacts"
              ? COLORS.accent
              : "rgba(255, 255, 255, 0.05)",
          borderWidth: activeTab === "contacts" ? 0 : 1,
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        <Text
          className="font-mono text-base text-center"
          style={{
            color:
              activeTab === "contacts"
                ? COLORS.white
                : "rgba(255, 255, 255, 0.6)",
          }}
        >
          Contacts
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("groups")}
        className="flex-1 py-3 rounded-2xl active:opacity-80"
        style={{
          backgroundColor:
            activeTab === "groups"
              ? COLORS.accent
              : "rgba(255, 255, 255, 0.05)",
          borderWidth: activeTab === "groups" ? 0 : 1,
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        <Text
          className="font-mono text-base text-center"
          style={{
            color:
              activeTab === "groups"
                ? COLORS.white
                : "rgba(255, 255, 255, 0.6)",
          }}
        >
          Groups
        </Text>
      </Pressable>
    </View>
  );
}
