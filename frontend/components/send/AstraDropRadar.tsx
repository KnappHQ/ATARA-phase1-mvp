import { useState, useRef } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { MotiView, AnimatePresence } from "moti";
import { Radar, Zap, User, ArrowRight } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { Contact } from "@/app/send";

const mockUsers = [
  { id: "1", name: "Alice Chen", avatar: "AC", handle: "@alice" },
  { id: "2", name: "Bob Smith", avatar: "BS", handle: "@bobsmith" },
];

interface AstraDropRadarProps {
  onSelectUser: (user: Contact) => void;
}

export const AstraDropRadar = ({ onSelectUser }: AstraDropRadarProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [detectedUsers, setDetectedUsers] = useState<Contact[]>([]);
  const [scanComplete, setScanComplete] = useState(false);

  const startScan = () => {
    if (isScanning) return;

    setIsScanning(true);
    setDetectedUsers([]);
    setScanComplete(false);

    // Simulate finding users after 3 seconds
    setTimeout(() => {
      setIsScanning(false);
      setScanComplete(true);
      setDetectedUsers(mockUsers);
    }, 3000);
  };

  const handleSelectUser = (user: Contact) => {
    onSelectUser(user);
  };

  return (
    <View className="mb-6">
      {/* Radar Scanner */}
      <View className="relative mx-auto" style={{ width: 200, height: 200 }}>
        {/* Radar Background */}
        <View
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderWidth: 1,
            borderColor: "rgba(132, 204, 255, 0.2)",
          }}
        >
          {/* Grid lines */}
          <View className="absolute inset-0">
            <View
              className="absolute left-0 right-0"
              style={{
                top: "50%",
                height: 1,
                backgroundColor: "rgba(132, 204, 255, 0.1)",
              }}
            />
            <View
              className="absolute top-0 bottom-0"
              style={{
                left: "50%",
                width: 1,
                backgroundColor: "rgba(132, 204, 255, 0.1)",
              }}
            />
            <View
              className="absolute rounded-full"
              style={{
                top: "25%",
                left: "25%",
                right: "25%",
                bottom: "25%",
                borderWidth: 1,
                borderColor: "rgba(132, 204, 255, 0.1)",
              }}
            />
            <View
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                right: 0,
                bottom: 0,
                borderWidth: 1,
                borderColor: "rgba(132, 204, 255, 0.05)",
              }}
            />
          </View>

          {/* Scanning waves */}
          {isScanning &&
            [0, 1, 2].map((i) => (
              <MotiView
                key={i}
                from={{ scale: 0.2, opacity: 0.8 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{
                  type: "timing",
                  duration: 2000,
                  loop: true,
                  delay: i * 600,
                }}
                className="absolute inset-0 rounded-full"
                style={{
                  borderWidth: 2,
                  borderColor: COLORS.sapphire,
                }}
              />
            ))}

          {/* Sweep line */}
          {isScanning && (
            <MotiView
              from={{ rotate: "0deg" }}
              animate={{ rotate: "360deg" }}
              transition={{
                type: "timing",
                duration: 2000,
                loop: true,
              }}
              className="absolute inset-0"
              style={{ transformOrigin: "center" }}
            >
              <View
                className="absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  width: "50%",
                  height: 2,
                  backgroundColor: "rgba(132, 204, 255, 0.8)",
                  opacity: 0.6,
                }}
              />
            </MotiView>
          )}

          {/* Detected user blips */}
          {scanComplete &&
            detectedUsers.map((user, index) => (
              <MotiView
                key={user.id}
                from={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  delay: index * 200,
                  damping: 15,
                }}
                className="absolute"
                style={{
                  top: index === 0 ? "30%" : "60%",
                  left: index === 0 ? "65%" : "25%",
                  transform: [{ translateX: -20 }, { translateY: -20 }],
                }}
              >
                <Pressable
                  onPress={() => handleSelectUser(user)}
                  className="active:opacity-70"
                >
                  <MotiView
                    from={{ scale: 1 }}
                    animate={{ scale: 1.2 }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: true,
                    }}
                    className="relative"
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: COLORS.sapphire,
                        shadowColor: COLORS.sapphire,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: COLORS.black }}
                      >
                        {user.avatar}
                      </Text>
                    </View>
                    {/* Pulse ring */}
                    <MotiView
                      from={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{
                        type: "timing",
                        duration: 1500,
                        loop: true,
                      }}
                      className="absolute inset-0 rounded-full"
                      style={{
                        borderWidth: 2,
                        borderColor: COLORS.sapphire,
                      }}
                    />
                  </MotiView>
                </Pressable>
              </MotiView>
            ))}

          {/* Center user avatar */}
          <View
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              transform: [{ translateX: -24 }, { translateY: -24 }],
            }}
          >
            <MotiView
              from={{ scale: 1 }}
              animate={isScanning ? { scale: 1.1 } : { scale: 1 }}
              transition={{
                type: "timing",
                duration: 1000,
                loop: isScanning,
              }}
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: 2,
                borderColor: "rgba(132, 204, 255, 0.3)",
              }}
            >
              <User size={20} color={COLORS.sapphire} />
            </MotiView>
          </View>
        </View>
      </View>

      {/* Scan Button */}
      <Pressable
        onPress={startScan}
        disabled={isScanning}
        className="mt-4 w-full py-3.5 rounded-xl flex-row items-center justify-center gap-3 active:opacity-80"
        style={{
          backgroundColor: isScanning
            ? "rgba(255, 255, 255, 0.03)"
            : COLORS.sapphire,
          borderWidth: isScanning ? 1 : 0,
          borderColor: isScanning ? "rgba(132, 204, 255, 0.3)" : "transparent",
        }}
      >
        {isScanning ? (
          <>
            <MotiView
              from={{ rotate: "0deg" }}
              animate={{ rotate: "360deg" }}
              transition={{
                type: "timing",
                duration: 1000,
                loop: true,
              }}
            >
              <Radar size={20} color={COLORS.sapphire} />
            </MotiView>
            <Text
              className="text-sm font-medium"
              style={{ color: COLORS.sapphire }}
            >
              Scanning nearby...
            </Text>
          </>
        ) : (
          <>
            <Zap size={20} color={COLORS.black} />
            <Text
              className="text-sm font-medium"
              style={{ color: COLORS.black }}
            >
              Find Nearby
            </Text>
          </>
        )}
      </Pressable>

      {/* Shake hint */}
      <Text
        className="text-center text-xs mt-2"
        style={{ color: "rgba(255, 255, 255, 0.5)" }}
      >
        {isScanning ? "Looking for ATARA users..." : "Tap to scan"}
      </Text>

      {/* Detected Users List */}
      {scanComplete && detectedUsers.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mt-4"
        >
          <Text
            className="text-xs font-medium uppercase mb-2"
            style={{
              color: COLORS.sapphire,
              letterSpacing: 2,
            }}
          >
            Found Nearby
          </Text>
          <View style={{ gap: 8 }}>
            {detectedUsers.map((user) => (
              <MotiView
                key={user.id}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
              >
                <Pressable
                  onPress={() => handleSelectUser(user)}
                  className="flex-row items-center gap-3 p-3 rounded-xl active:opacity-70"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 1)",
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: COLORS.white }}
                    >
                      {user.avatar}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: COLORS.white }}
                    >
                      {user.name}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: "rgba(255, 255, 255, 0.5)" }}
                    >
                      {user.handle}
                    </Text>
                  </View>
                  <ArrowRight size={16} color={COLORS.sapphire} />
                </Pressable>
              </MotiView>
            ))}
          </View>
        </MotiView>
      )}
    </View>
  );
};
