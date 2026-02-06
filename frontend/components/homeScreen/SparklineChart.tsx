import { useMemo } from "react";
import { View } from "react-native";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

interface SparklineChartProps {
  data: number[];
  color?: string;
  fillOpacity?: number;
  showEndPoint?: boolean;
}

export const SparklineChart = ({
  data,
  color = "#84CCFF",
  fillOpacity = 0.15,
  showEndPoint = true,
}: SparklineChartProps) => {
  // Create smooth spline path using Catmull-Rom spline interpolation
  const { splinePath, areaPath, endPointY } = useMemo(() => {
    if (data.length < 2) {
      return { splinePath: "", areaPath: "", endPointY: 30 };
    }

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;

    // Normalize data points to SVG coordinates
    const points = data.map((val, i) => ({
      x: (i / (data.length - 1)) * 200,
      y: 60 - ((val - minVal) / range) * 50,
    }));

    // Build Catmull-Rom spline path
    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const area = `${path} L 200,60 L 0,60 Z`;
    const endY = points[points.length - 1].y;

    return { splinePath: path, areaPath: area, endPointY: endY };
  }, [data]);

  return (
    <View className="flex-1 h-14">
      <Svg viewBox="0 0 200 60" style={{ width: "100%", height: "100%" }}>
        <Defs>
          <LinearGradient
            id={`gradient-${color}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#gradient-${color})`} />

        {/* Spline line */}
        <Path
          d={splinePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />

        {/* End point */}
        {showEndPoint && <Circle cx="200" cy={endPointY} r="4" fill={color} />}
      </Svg>
    </View>
  );
};
