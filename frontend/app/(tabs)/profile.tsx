import "react-native-get-random-values";
import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { MotiView } from "moti";
import {
  LogOut,
  Bug,
  FileText,
  ShieldCheck,
  ChevronRight,
  Trash2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { FeedbackModal } from "@/components/profile/FeedbackModal";
import { DisplayNameModal } from "@/components/profile/DisplayNameModal";
import { DeleteAccountModal } from "@/components/profile/DeleteAccountModal";
import { LogoutModal } from "@/components/profile/LogoutModal";
import { TermsOfServiceScreen } from "@/components/profile/TermsOfServiceScreen";
import { PrivacyPolicyScreen } from "@/components/profile/PrivacyPolicyScreen";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthStore } from "@/stores/useAuthStore";
import { getInitials } from "@/utils/format";
import { UserService } from "@/services/user.service";

const SettingRow = ({
  icon: Icon,
  label,
  subtitle,
  right,
  onPress,
  delay = 0,
  disabled = false,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  delay?: number;
  disabled?: boolean;
}) => (
  <MotiView
    from={{ opacity: 0, translateY: 10 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: "timing", duration: 300, delay }}
  >
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      className="flex-row items-center rounded-3xl px-4 py-5 mb-3 border border-white/10"
      style={{
        backgroundColor: `${COLORS.white}06`,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View className="w-11 h-11 rounded-2xl items-center justify-center bg-white/10">
        <Icon size={20} color={COLORS.accent} />
      </View>

      <View className="flex-1 ml-4">
        <Text className="text-white text-base font-semibold leading-6">
          {label}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-white/55 mt-1">{subtitle}</Text>
        ) : null}
      </View>

      <View className="items-center justify-center">{right}</View>
    </Pressable>
  </MotiView>
);

const SectionHeader = ({
  title,
  delay = 0,
}: {
  title: string;
  delay?: number;
}) => (
  <MotiView
    from={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ type: "timing", duration: 300, delay }}
  >
    <Text
      className="text-xs font-mono uppercase mb-3 mt-4"
      style={{ color: `${COLORS.white}40`, letterSpacing: 1.5 }}
    >
      {title}
    </Text>
  </MotiView>
);

export default function ProfileTab() {
  const { user, updateProfile } = useAuthStore();
  const { logout } = useAuth();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const [displayNameOpen, setDisplayNameOpen] = useState(false);
  const [displayNameSaving, setDisplayNameSaving] = useState(false);

  const initials = getInitials(user?.displayName ?? null, user?.handle ?? "");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const openEditName = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayNameOpen(true);
  };

  const closeDisplayNameModal = () => {
    setDisplayNameOpen(false);
  };

  const saveDisplayName = async (displayName: string) => {
    setDisplayNameSaving(true);
    try {
      await updateProfile({ displayName });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDisplayNameOpen(false);
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const deleteAccount = async () => {
    await UserService.deleteAccount();
    await logout();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.black }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300 }}
          className="flex-row items-center justify-between px-6 pt-5 pb-4"
        >
          <Text className="text-white text-2xl font-semibold">Profile</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setLogoutOpen(true);
            }}
            className="w-10 h-10 rounded-full items-center justify-center border border-white/10"
            style={{ backgroundColor: `${COLORS.white}08` }}
          >
            <LogOut size={18} color={`${COLORS.white}60`} />
          </Pressable>
        </MotiView>

        <View className="px-6">
          <ProfileAvatar initials={initials} />

          <IdentityCard
            displayName={user?.displayName}
            handle={user?.handle}
            smartAccountAddress={user?.smartAccountAddress}
            isVerified={!!user?.smartAccountAddress}
            onEditDisplayName={openEditName}
          />

          <SectionHeader title="Beta Program" delay={360} />

          <SettingRow
            icon={Bug}
            label="Report Bug or Feedback"
            subtitle="Help us improve Atara"
            delay={420}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFeedbackOpen(true);
            }}
            right={<ChevronRight size={16} color={`${COLORS.white}30`} />}
          />

          <SectionHeader title="Legal" delay={360} />

          <SettingRow
            icon={FileText}
            label="Terms of Service"
            delay={390}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTermsOpen(true);
            }}
            right={<ChevronRight size={16} color={`${COLORS.white}30`} />}
          />

          <SettingRow
            icon={ShieldCheck}
            label="Privacy Policy"
            delay={420}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPrivacyOpen(true);
            }}
            right={<ChevronRight size={16} color={`${COLORS.white}30`} />}
          />

          <SectionHeader title="Account" delay={450} />

          <SettingRow
            icon={Trash2}
            label="Delete Account"
            subtitle="Permanently remove your ATARA account"
            delay={480}
            onPress={() => setDeleteAccountOpen(true)}
            right={<ChevronRight size={16} color={`${COLORS.white}30`} />}
          />

          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "timing", duration: 400, delay: 480 }}
            className="items-center mt-8 mb-4"
          >
            <Text
              className="text-xs font-mono"
              style={{ color: `${COLORS.white}40`, letterSpacing: 1 }}
            >
              ATARA · Beta v0.1.0
            </Text>
          </MotiView>
        </View>
      </ScrollView>

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <LogoutModal
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
      <TermsOfServiceScreen
        isOpen={termsOpen}
        onBack={() => setTermsOpen(false)}
      />
      <PrivacyPolicyScreen
        isOpen={privacyOpen}
        onBack={() => setPrivacyOpen(false)}
      />

      <DisplayNameModal
        isOpen={displayNameOpen}
        displayName={user?.displayName ?? ""}
        isSaving={displayNameSaving}
        onClose={closeDisplayNameModal}
        onSave={saveDisplayName}
      />
      <DeleteAccountModal
        isOpen={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirm={deleteAccount}
      />
    </View>
  );
}
