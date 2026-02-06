import { ReactNode } from "react";
import { View, StyleSheet } from "react-native";

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
      style={{ backgroundColor: "#000000" }}
    >
      {children}
    </View>
  );
};
