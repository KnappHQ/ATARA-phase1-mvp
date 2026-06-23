import { View, Text, ScrollView, Modal, Pressable } from "react-native";
import { MotiView } from "moti";
import { ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { COLORS } from "@/utils/constants";
import { TNC_SECTIONS, TNC_LAST_UPDATED, TNC_FOOTER_TEXT } from "@/utils/tnc";

interface TermsOfServiceScreenProps {
  isOpen: boolean;
  onBack: () => void;
}

export const TermsOfServiceScreen = ({
  isOpen,
  onBack,
}: TermsOfServiceScreenProps) => {
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  const handleOpenLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleBack}
    >
      <View className="flex-1" style={{ backgroundColor: COLORS.black }}>
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 250 }}
          className="flex-row items-center gap-3 px-6 pt-14 pb-4 border-b"
          style={{ borderBottomColor: `${COLORS.white}10` }}
        >
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 rounded-full items-center justify-center border border-white/10"
            style={{ backgroundColor: `${COLORS.white}08` }}
          >
            <ArrowLeft size={18} color={COLORS.white} />
          </Pressable>
          <Text className="text-lg font-semibold text-white">
            Terms of Service
          </Text>
        </MotiView>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-xs font-mono mb-6"
            style={{ color: `${COLORS.white}60` }}
          >
            Last Updated: {TNC_LAST_UPDATED}
          </Text>

          {TNC_SECTIONS.map((section, idx) => {
            const link = section.link;

            return (
              <MotiView
                key={idx}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: "timing",
                  duration: 200,
                  delay: 60 + idx * 40,
                }}
                className="mb-6"
              >
                <Text className="text-white font-semibold text-base mb-2">
                  {section.title}
                </Text>
                {section.highlight && (
                  <Text className="text-white font-medium text-base mb-2">
                    {section.highlight}
                  </Text>
                )}
                <Text
                  className="text-sm leading-5"
                  style={{ color: `${COLORS.white}80` }}
                >
                  {section.body}
                </Text>
                {link && (
                  <Text
                    onPress={() => handleOpenLink(link.url)}
                    className="mt-2 text-sm font-semibold underline underline-offset-2"
                    style={{ color: COLORS.white }}
                  >
                    {link.label}
                  </Text>
                )}
                {section.bullets?.map((bullet, bIdx) => (
                  <View key={bIdx} className="flex-row mt-1.5 pl-2">
                    <Text
                      className="text-sm mr-2"
                      style={{ color: `${COLORS.white}40` }}
                    >
                      •
                    </Text>
                    <Text
                      className="text-sm flex-1 leading-5"
                      style={{ color: `${COLORS.white}50` }}
                    >
                      {bullet}
                    </Text>
                  </View>
                ))}
              </MotiView>
            );
          })}

          <View
            className="pt-6 border-t"
            style={{ borderTopColor: `${COLORS.white}08` }}
          >
            <Text
              className="text-xs text-center"
              style={{ color: `${COLORS.white}60` }}
            >
              {TNC_FOOTER_TEXT}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
