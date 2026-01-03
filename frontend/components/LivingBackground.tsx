import { LinearGradient } from "expo-linear-gradient";

export const LivingBackground = () => {
  return (
    <LinearGradient
      colors={["#05010A", "#0A0414", "#160824", "#1A0B2E", "#12061E"]}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="absolute inset-0"
    />
  );
};
