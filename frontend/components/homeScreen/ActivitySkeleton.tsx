import { View } from "react-native";
import { MotiView } from "moti";

const BG = "rgba(255, 255, 255, 0.07)";
const BG_DIM = "rgba(255, 255, 255, 0.04)";

interface BlockProps {
  width: number;
  height: number;
  radius?: number;
  bg?: string;
}

const Block = ({ width, height, radius = 6, bg = BG }: BlockProps) => (
  <View style={{ width, height, borderRadius: radius, backgroundColor: bg }} />
);

export const TransactionsSkeleton = () => (
  <View>
    {[0, 1, 2, 3, 4].map((i) => (
      <MotiView
        key={i}
        from={{ opacity: 0.7 }}
        animate={{ opacity: 0.9 }}
        transition={{
          type: "timing",
          duration: 850,
          loop: true,
          delay: i * 90,
        }}
        className="px-4 py-4 rounded-3xl mb-2 bg-white/5 border border-white/10"
      >
        <View className="flex-row items-center gap-4">
          <View
            className="w-12 h-12 rounded-full"
            style={{ backgroundColor: BG }}
          />
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1.5">
              <Block width={130} height={14} />
              <Block width={72} height={14} />
            </View>
            <View className="flex-row items-center justify-between">
              <Block width={90} height={11} bg={BG_DIM} />
              <Block width={44} height={11} bg={BG_DIM} />
            </View>
          </View>
        </View>
      </MotiView>
    ))}
  </View>
);

export const ContactsSkeleton = () => (
  <View>
    {[0, 1, 2, 3, 4].map((i) => (
      <MotiView
        key={i}
        from={{ opacity: 0.55 }}
        animate={{ opacity: 0.9 }}
        transition={{
          type: "timing",
          duration: 850,
          loop: true,
          delay: i * 90,
        }}
        className="p-4 rounded-2xl mb-2 bg-white/5 border border-white/10"
      >
        <View className="flex-row items-center gap-4">
          <View
            className="w-12 h-12 rounded-full"
            style={{ backgroundColor: BG }}
          />
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1.5">
              <Block width={140} height={14} />
              <Block width={40} height={11} bg={BG_DIM} />
            </View>
            <View style={{ marginBottom: 6 }}>
              <Block width={170} height={11} bg={BG_DIM} />
            </View>
            <Block width={80} height={10} bg={BG_DIM} radius={4} />
          </View>
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: BG_DIM,
            }}
          />
        </View>
      </MotiView>
    ))}
  </View>
);

