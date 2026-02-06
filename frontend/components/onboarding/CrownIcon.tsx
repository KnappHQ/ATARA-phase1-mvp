import Svg, { Rect } from "react-native-svg";

interface CrownIconProps {
  size?: number;
  color?: string;
}

/**
 * ATARA Logo - Three vertical pillars
 * Universal Sovereignty - Stability and strength
 */
export const CrownIcon = ({ size = 56, color = "#FFFFFF" }: CrownIconProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Three vertical pillars */}
      <Rect x="4" y="4" width="3" height="16" fill={color} />
      <Rect x="10.5" y="4" width="3" height="16" fill={color} />
      <Rect x="17" y="4" width="3" height="16" fill={color} />
    </Svg>
  );
};
