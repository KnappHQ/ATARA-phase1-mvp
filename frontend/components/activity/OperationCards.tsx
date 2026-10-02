import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import { COLORS } from "@/utils/constants";
import type { CardAction, OperationCard, CardTone } from "@/utils/operationPresentation";

const BORDER: Record<CardTone, string> = {
  waiting: "rgba(251,191,36,0.4)",
  good: "rgba(74,222,128,0.4)",
  bad: "rgba(248,113,113,0.45)",
  neutral: "rgba(255,255,255,0.2)",
};

const Detail = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{label}</Text>
      <Text selectable style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label}`}
        hitSlop={8}
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Selecting the text above still works.
          }
        }}
      >
        <Text style={{ color: COLORS.accent, fontSize: 12, marginTop: 2 }}>{copied ? "Copied" : "Copy"}</Text>
      </Pressable>
    </View>
  );
};

const Card = ({
  card,
  busy,
  onAction,
}: {
  card: OperationCard;
  busy: boolean;
  onAction: (action: CardAction["id"]) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: BORDER[card.tone], padding: 16, marginBottom: 16 }}>
      <Text style={{ color: "#fff", fontWeight: "600", marginBottom: 6 }}>{card.title}</Text>
      {!!card.payment && (
        <Text style={{ color: "#fff", marginBottom: 2 }}>
          {card.payment.charAt(0).toUpperCase() + card.payment.slice(1)}
        </Text>
      )}
      {!!card.when && <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>{`Sent ${card.when}`}</Text>}
      <Text style={{ color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>{card.body}</Text>

      {card.actions.map((action) => (
        <Pressable
          key={action.id}
          disabled={busy && (action.id === "check" || action.id === "retry-check")}
          accessibilityRole="button"
          onPress={() => onAction(action.id)}
          style={{ paddingVertical: 6 }}
        >
          <Text style={{ color: action.destructive ? "rgba(255,255,255,0.6)" : COLORS.accent }}>{action.label}</Text>
        </Pressable>
      ))}

      {(card.details.length > 0 || card.evidence.length > 0) && (
        <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={{ paddingVertical: 6 }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{open ? "Hide details" : "Show details"}</Text>
        </Pressable>
      )}
      {open && (
        <View>
          {card.details.map((detail) => (
            <Detail key={detail.label} {...detail} />
          ))}
          {card.evidence.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>What was checked</Text>
              {card.evidence.map((line, index) => (
                <Text key={`${index}:${line}`} style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export const OperationCards = ({
  cards,
  checking,
  onAction,
  note,
  onDismissNote,
}: {
  cards: OperationCard[];
  checking: boolean;
  onAction: (action: CardAction["id"]) => void;
  note?: string | null;
  onDismissNote?: () => void;
}) => (
  <View>
    {!!note && (
      <Pressable onPress={onDismissNote} style={{ marginBottom: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)" }}>{note}</Text>
      </Pressable>
    )}
    {cards.map((card) => (
      <Card key={card.key} card={card} busy={checking} onAction={onAction} />
    ))}
  </View>
);
