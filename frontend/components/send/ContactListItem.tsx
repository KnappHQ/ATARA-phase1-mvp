import { ArrowRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

interface ContactListItemProps {
  name: string;
  handle: string;
  avatar: string;
  onPress: () => void;
}

export const ContactListItem = ({
  name,
  handle,
  avatar,
  onPress,
}: ContactListItemProps) => {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center gap-3 p-3 bg-[#100f12] border border-champagne/10 rounded-xl active:opacity-80"
    >
      <View className="w-10 h-12 rounded-full bg-muted items-center justify-center">
        <Text className="text-sm font-rajdhani-bold text-foreground">
          {avatar}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-rajdhani-medium text-foreground">
          {name}
        </Text>
        <Text className="text-xs font-rajdhani text-muted-foreground">
          {handle}
        </Text>
      </View>
      <ArrowRight size={16} color="rgba(255, 255, 255, 0.4)" />
    </Pressable>
  );
};
