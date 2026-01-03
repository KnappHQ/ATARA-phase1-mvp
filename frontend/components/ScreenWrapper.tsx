import { ReactNode } from "react";
import { View } from "react-native";
import { LivingBackground } from "./LivingBackground";

interface ScreenWrapperProps {
  children: ReactNode;
  className?: string;
}

export const ScreenWrapper = ({
  children,
  className = "",
}: ScreenWrapperProps) => {
  return (
    <View
      className={`flex-1 ${className}`}
      style={{ backgroundColor: "transparent" }}
    >
      <LivingBackground />
      {children}
    </View>
  );
};
