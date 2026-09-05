import { View, Text } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";

interface ProfileAvatarProps {
  initials?: string;
}

export const ProfileAvatar = ({ initials = "TV" }: ProfileAvatarProps) => {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 200, delay: 100 }}
      className="items-center mb-5"
    >
      <View
        className="w-28 h-28 rounded-full items-center justify-center"
        style={{
          borderWidth: 2,
          borderColor: `${COLORS.accent}40`,
        }}
      >
        <View
          className="w-24 h-24 rounded-full items-center justify-center"
          style={{
            backgroundColor: `${COLORS.accent}15`,
            borderWidth: 2,
            borderColor: COLORS.accent,
          }}
        >
          <Text className="text-2xl font-bold" style={{ color: COLORS.accent }}>
            {initials}
          </Text>
        </View>
      </View>
    </MotiView>
  );
};
