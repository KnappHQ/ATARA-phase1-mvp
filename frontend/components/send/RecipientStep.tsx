import { useState } from "react";
import { Keyboard, ScrollView } from "react-native";
import { Contact, DUMMY_CONTACTS } from "@/app/send";
import { AstraDropButton } from "./AstraDropButton";
import { QuickSendSection } from "./QuickSendSection";
import { ContactsList } from "./ContactsList";

interface RecipientStepProps {
  onSelectRecipient: (contact: Contact) => void;
}

const quickContacts = [
  { id: "1", name: "Alex", avatar: "AC" },
  { id: "2", name: "Maria", avatar: "MS" },
  { id: "3", name: "John", avatar: "JD" },
  { id: "4", name: "Sarah", avatar: "SK" },
  { id: "5", name: "Marcus", avatar: "MJ" },
];

export const RecipientStep = ({ onSelectRecipient }: RecipientStepProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContacts = searchQuery
    ? DUMMY_CONTACTS.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.handle.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : DUMMY_CONTACTS;

  const handleSelectContact = (contact: Contact) => {
    onSelectRecipient(contact);
    Keyboard.dismiss();
  };

  const handleQuickContact = (quick: (typeof quickContacts)[0]) => {
    const fullContact = DUMMY_CONTACTS.find((c) => c.id === quick.id);
    if (fullContact) {
      handleSelectContact(fullContact);
    }
  };

  const handleAstraDrop = () => {
    console.log("ATARA Drop button pressed");
  };

  return (
    <ScrollView
      className="flex-1 bg-black"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}
    >
      <AstraDropButton onPress={handleAstraDrop} />

      <QuickSendSection
        contacts={quickContacts}
        onSelectContact={handleQuickContact}
      />

      <ContactsList
        contacts={filteredContacts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectContact={handleSelectContact}
      />
    </ScrollView>
  );
};
