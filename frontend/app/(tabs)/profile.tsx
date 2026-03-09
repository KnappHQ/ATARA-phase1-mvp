import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { MotiView } from "moti";
import {
  LogOut,
  Bug,
  FileText,
  ShieldCheck,
  ChevronRight,
  X,
  Check,
  ScanFace,
  DollarSign,
  Ghost,
  Palette,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { FeedbackModal } from "@/components/profile/FeedbackModal";
import { LogoutModal } from "@/components/profile/LogoutModal";
import { TermsOfServiceScreen } from "@/components/profile/TermsOfServiceScreen";
import { useAuthStore } from "@/stores/useAuthStore";
import { getInitials } from "@/utils/format";

interface PillOption {
  label: string;
  value: string;
}

const PillGroup = ({
  options,
  selected,
  onSelect,
}: {
  options: PillOption[];
  selected: string;
  onSelect: (v: string) => void;
}) => (
  <View className="flex-row gap-2">
    {options.map((opt) => {
      const active = opt.value === selected;
      return (
        <Pressable
          key={opt.value}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(opt.value);
          }}
          className="px-4 py-2 rounded-full"
          style={{
            backgroundColor: active ? COLORS.accent : `${COLORS.white}08`,
          }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: active ? COLORS.white : `${COLORS.white}50` }}
          >
            {opt.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const SettingRow = ({
  icon: Icon,
  label,
  right,
  onPress,
  delay = 0,
  disabled = false,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
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
      className="flex-row items-center rounded-2xl p-4 mb-2 border border-white/10"
      style={{
        backgroundColor: `${COLORS.white}05`,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon size={18} color={COLORS.accent} />
      <Text className="text-white text-sm font-medium flex-1 ml-3">
        {label}
      </Text>
      {right}
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

  const [faceId, setFaceId] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);
  const [currency, setCurrency] = useState("usd");
  const [theme, setTheme] = useState("cyber");

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const initials = getInitials(user?.displayName ?? null, user?.handle ?? "");

  const openEditName = () => {
    setEditValue(user?.displayName ?? "");
    setEditError(null);
    setEditSuccess(false);
    setEditOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveDisplayName = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditError("Display name cannot be empty.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateProfile({ displayName: trimmed });
      setEditSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setEditOpen(false);
        setEditSuccess(false);
      }, 1200);
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ?? "Failed to update display name.",
      );
    } finally {
      setEditSaving(false);
    }
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

          <SectionHeader title="Settings" delay={250} />

          <SettingRow
            icon={ScanFace}
            label="Face ID"
            delay={280}
            right={
              <Switch
                value={faceId}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFaceId(val);
                }}
                trackColor={{
                  false: `${COLORS.white}15`,
                  true: COLORS.accent,
                }}
                thumbColor={COLORS.white}
              />
            }
          />

          <SettingRow
            icon={DollarSign}
            label="Currency"
            delay={310}
            right={
              <PillGroup
                options={[
                  { label: "USD", value: "usd" },
                  { label: "EUR", value: "eur" },
                ]}
                selected={currency}
                onSelect={setCurrency}
              />
            }
          />

          <SettingRow
            icon={Ghost}
            label="Stealth Mode"
            delay={340}
            right={
              <Switch
                value={stealthMode}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStealthMode(val);
                }}
                trackColor={{
                  false: `${COLORS.white}15`,
                  true: COLORS.accent,
                }}
                thumbColor={COLORS.white}
              />
            }
          />

          <SectionHeader title="Appearance" delay={360} />

          <SettingRow
            icon={Palette}
            label="Theme"
            delay={380}
            right={
              <PillGroup
                options={[
                  { label: "Cyber", value: "cyber" },
                  { label: "Heritage", value: "heritage" },
                ]}
                selected={theme}
                onSelect={setTheme}
              />
            }
          />

          <SectionHeader title="Beta Program" delay={400} />

          <SettingRow
            icon={Bug}
            label="Report Bug"
            delay={330}
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
            disabled
            right={<ChevronRight size={16} color={`${COLORS.white}15`} />}
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

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => !editSaving && setEditOpen(false)}
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
          >
            <TouchableOpacity activeOpacity={1}>
              <MotiView
                from={{ translateY: 80, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                style={{
                  backgroundColor: "#0a0a0a",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  borderWidth: 1,
                  borderColor: `${COLORS.white}18`,
                  paddingBottom: 40,
                  paddingHorizontal: 24,
                  paddingTop: 12,
                }}
              >
                <View className="items-center mb-4">
                  <View
                    className="w-10 h-1 rounded-full"
                    style={{ backgroundColor: `${COLORS.white}20` }}
                  />
                </View>

                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-lg font-semibold text-white">
                    Edit Display Name
                  </Text>
                  <Pressable
                    onPress={() => !editSaving && setEditOpen(false)}
                    className="w-9 h-9 rounded-full items-center justify-center border border-white/10"
                    style={{ backgroundColor: `${COLORS.white}08` }}
                  >
                    <X size={16} color={`${COLORS.white}60`} />
                  </Pressable>
                </View>

                {editSuccess ? (
                  <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", damping: 20, stiffness: 280 }}
                    className="items-center py-8"
                  >
                    <View
                      className="w-14 h-14 rounded-full items-center justify-center mb-3"
                      style={{ backgroundColor: `${COLORS.accent}20` }}
                    >
                      <Check size={24} color={COLORS.accent} />
                    </View>
                    <Text className="text-white font-semibold">
                      Display name updated
                    </Text>
                  </MotiView>
                ) : (
                  <>
                    <TextInput
                      value={editValue}
                      onChangeText={(t) => {
                        setEditValue(t);
                        setEditError(null);
                      }}
                      placeholder="Your display name"
                      placeholderTextColor={`${COLORS.white}30`}
                      autoFocus
                      maxLength={40}
                      className="rounded-2xl text-base text-white px-4 py-4 mb-2"
                      style={{
                        backgroundColor: `${COLORS.white}05`,
                        borderWidth: 1,
                        borderColor: editError
                          ? "#ef4444"
                          : `${COLORS.white}10`,
                      }}
                    />

                    {editError && (
                      <Text
                        className="text-xs mb-3"
                        style={{ color: "#ef4444" }}
                      >
                        {editError}
                      </Text>
                    )}

                    <Pressable
                      onPress={saveDisplayName}
                      disabled={editSaving || !editValue.trim()}
                      className="py-4 rounded-2xl items-center justify-center mt-2"
                      style={{
                        backgroundColor:
                          editSaving || !editValue.trim()
                            ? `${COLORS.accent}40`
                            : COLORS.accent,
                      }}
                    >
                      {editSaving ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text className="text-sm font-semibold text-white tracking-wide">
                          Save
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}
              </MotiView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
      <TermsOfServiceScreen
        isOpen={termsOpen}
        onBack={() => setTermsOpen(false)}
      />
    </View>
  );
}
