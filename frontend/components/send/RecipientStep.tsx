import { useState } from "react";
import { Keyboard, ScrollView } from "react-native";
import { Contact, useContactStore } from "@/stores/useContactStore";
import { AstraDropButton } from "./AstraDropButton";
import { QuickSendSection } from "./QuickSendSection";
import { ContactsList } from "./ContactsList";

interface RecipientStepProps {
  onSelectRecipient: (contact: Contact) => void;
}

export const RecipientStep = ({ onSelectRecipient }: RecipientStepProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { recentContacts, isLoadingRecents } = useContactStore();

  const handleSelectContact = (contact: Contact) => {
    onSelectRecipient(contact);
    Keyboard.dismiss();
  };

  const handleAstraDrop = () => {
    console.log("ATARA Drop button pressed");
  };

  const handleQuickContactSelect = (quickContact: {
    id: string;
    name: string;
    avatar: string;
  }) => {
    const originalContact = recentContacts.find(
      (c) => c.id === quickContact.id,
    );
    if (originalContact) {
      handleSelectContact(originalContact);
    }
  };

  const quickContacts = recentContacts.slice(0, 5).map((contact) => ({
    id: contact.id,
    name: contact.handle,
    avatar: contact.handle.replace(/^@/, "").slice(0, 2).toUpperCase(),
  }));

  return (
    <ScrollView
      className="flex-1 bg-black"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}
    >
      <AstraDropButton onPress={handleAstraDrop} />

      <QuickSendSection
        contacts={quickContacts}
        onSelectContact={handleQuickContactSelect}
      />

      <ContactsList
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectContact={handleSelectContact}
      />
    </ScrollView>
  );
};
