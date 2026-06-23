import { View, Text, ScrollView, Modal, Pressable } from "react-native";
import { MotiView } from "moti";
import { ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import {
  PRIVACY_POLICY_FOOTER_TEXT,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "@/utils/privacyPolicy";

interface PrivacyPolicyScreenProps {
  isOpen: boolean;
  onBack: () => void;
}

export const PrivacyPolicyScreen = ({
  isOpen,
  onBack,
}: PrivacyPolicyScreenProps) => {
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
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
            Privacy Policy
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
            Last Updated: {PRIVACY_POLICY_LAST_UPDATED}
          </Text>

          <Text
            className="text-sm leading-5 mb-6"
            style={{ color: `${COLORS.white}80` }}
          >
            {PRIVACY_POLICY_INTRO}
          </Text>

          {PRIVACY_POLICY_SECTIONS.map((section, idx) => (
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
              {section.body.map((paragraph, paragraphIdx) => (
                <Text
                  key={paragraphIdx}
                  className="text-sm leading-5 mb-2"
                  style={{ color: `${COLORS.white}80` }}
                >
                  {paragraph}
                </Text>
              ))}
              {section.bullets?.map((bullet, bulletIdx) => (
                <View key={bulletIdx} className="flex-row mt-1.5 pl-2">
                  <Text
                    className="text-sm mr-2"
                    style={{ color: `${COLORS.white}40` }}
                  >
                    •
                  </Text>
                  <Text
                    className="text-sm flex-1 leading-5"
                    style={{ color: `${COLORS.white}60` }}
                  >
                    {bullet}
                  </Text>
                </View>
              ))}
            </MotiView>
          ))}

          <View
            className="pt-6 border-t"
            style={{ borderTopColor: `${COLORS.white}08` }}
          >
            <Text
              className="text-xs text-center"
              style={{ color: `${COLORS.white}60` }}
            >
              {PRIVACY_POLICY_FOOTER_TEXT}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
