import React from "react";
import { View } from "react-native";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

export const SparklineChart = ({
  data = [],
  width = 320,
  height = 100,
}: {
  data: number[];
  width?: number;
  height?: number;
}) => {
  if (!data || data.length === 0) {
    return <View style={{ width, height }} />;
  }
  const padding = 16;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * availableWidth;
    let y;
    if (range === 0) {
      y = height - padding;
    } else {
      y =
        padding +
        availableHeight -
        ((value - minValue) / range) * availableHeight;
    }
    return { x, y };
  });

  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return "";
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i];
      const next = pts[i + 1];
      const cpx = (current.x + next.x) / 2;
      path += ` C ${cpx},${current.y} ${cpx},${next.y} ${next.x},${next.y}`;
    }
    return path;
  };

  const linePath = createSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x},${height - padding} L ${padding},${height - padding} Z`
      : "";

  const lastPoint = points[points.length - 1] || { x: 0, y: 0 };

  return (
    <View className="w-full h-[100px] bg-transparent">
      <Svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <Defs>
          <LinearGradient
            id="pulseLineGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <Stop offset="0%" stopColor="#FFD666" stopOpacity="0.5" />
            <Stop offset="50%" stopColor="#FFEB99" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFD666" stopOpacity="0.5" />
          </LinearGradient>
          <LinearGradient
            id="pulseAreaGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FFEB99" stopOpacity="0.25" />
            <Stop offset="50%" stopColor="#FFD666" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d={areaPath} fill="url(#pulseAreaGradient)" />

        <Path
          d={linePath}
          fill="none"
          stroke="url(#pulseLineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="10"
          fill="#E5D2A6"
          opacity={0.15}
        />

        <Circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="5"
          fill="#FFEB99"
          opacity={0.9}
        />

        <Circle cx={lastPoint.x} cy={lastPoint.y} r="2.5" fill="#FFF5CC" />
      </Svg>
    </View>
  );
};
