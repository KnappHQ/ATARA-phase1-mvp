import { Pressable, ScrollView, Text, View } from "react-native";
import { MotiView } from "moti";

interface QuickContact {
  id: string;
  name: string;
  avatar: string;
}

interface QuickSendSectionProps {
  contacts: QuickContact[];
  onSelectContact: (contact: QuickContact) => void;
}

export const QuickSendSection = ({
  contacts,
  onSelectContact,
}: QuickSendSectionProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay: 100 }}
      className="mb-6"
    >
      <Text className="text-sm font-medium uppercase mb-4 tracking-widest text-primary">
        Quick Send
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
      >
        {contacts.map((contact, index) => (
          <MotiView
            key={contact.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: "timing",
              duration: 100,
              delay: index * 20,
            }}
          >
            <Pressable
              onPress={() => onSelectContact(contact)}
              className="flex-col items-center gap-2 px-2 py-3 rounded-2xl active:opacity-70"
              style={{
                minWidth: 72,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <Text className="text-sm font-bold text-white">
                  {contact.avatar}
                </Text>
              </View>
              <Text className="text-sm text-muted">{contact.name}</Text>
            </Pressable>
          </MotiView>
        ))}
      </ScrollView>
    </MotiView>
  );
};
