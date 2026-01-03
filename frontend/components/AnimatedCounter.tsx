import { useEffect, useState } from "react";
import { Text, TextStyle } from "react-native";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  style?: TextStyle;
  glowing?: boolean;
}

export const AnimatedCounter = ({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1500,
  className = "",
  style,
  glowing = false,
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(value * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  const formattedValue = displayValue
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const textContent = `${prefix}${formattedValue}${suffix}`;

  if (glowing) {
    return (
      <Text
        className={className}
        style={[
          style,
          {
            color: "#FCD34D",
            textShadowColor: "rgba(252, 211, 77, 0.6)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 30,
          },
        ]}
      >
        {textContent}
      </Text>
    );
  }

  return (
    <Text className={className} style={style}>
      {textContent}
    </Text>
  );
};
