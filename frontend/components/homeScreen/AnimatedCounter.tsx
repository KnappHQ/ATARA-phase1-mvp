import { useEffect, useState, useRef } from "react";
import { Text } from "react-native";
import { MotiText } from "moti";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  onComplete?: () => void;
}

export const AnimatedCounter = ({
  value,
  duration = 2000,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  onComplete,
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function - ease out cubic
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);

      const currentValue = easeOutCubic * value;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, onComplete]);

  const formattedValue = displayValue.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // Split into whole and decimal parts
  const [wholePart, decimalPart] = formattedValue.split(".");

  return (
    <MotiText
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      {prefix}
      <Text>{wholePart}</Text>
      {decimals > 0 && decimalPart && (
        <Text className="opacity-60">.{decimalPart}</Text>
      )}
      {suffix}
    </MotiText>
  );
};
