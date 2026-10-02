import { Text, View, useWindowDimensions } from "react-native";

import { MAX_ROW_FONT_MULTIPLIER, rowLayout } from "@/utils/rowLayout";

/**
 * The top of a payment row: who it is with, their address, and the amount, each
 * in its own zone (see utils/rowLayout.ts). The name gives way to the amount and
 * the address, never the other way round, and none of them draws over another.
 */
export const RowHeader = ({
  name,
  address,
  amount,
  amountColor,
  nameClassName,
  addressClassName,
  amountClassName,
  amountStyle,
}: {
  name: string;
  /** Already shortened; omitted when the name already says who it is. */
  address?: string | null;
  amount: string;
  amountColor: string;
  nameClassName?: string;
  addressClassName?: string;
  amountClassName?: string;
  amountStyle?: object;
}) => {
  const { fontScale, width } = useWindowDimensions();
  const { stacked, amountMaxWidth } = rowLayout(fontScale, width);
  return (
    <View style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "flex-start" }}>
      <View testID="row-identity" style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
        <Text
          className={nameClassName}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={MAX_ROW_FONT_MULTIPLIER}
        >
          {name}
        </Text>
        {address ? (
          <Text
            className={addressClassName}
            numberOfLines={1}
            ellipsizeMode="middle"
            maxFontSizeMultiplier={MAX_ROW_FONT_MULTIPLIER}
          >
            {address}
          </Text>
        ) : null}
      </View>
      <Text
        testID="row-amount"
        className={amountClassName}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={MAX_ROW_FONT_MULTIPLIER}
        style={[
          { color: amountColor },
          stacked
            ? { marginTop: 2 }
            : { flexShrink: 0, maxWidth: amountMaxWidth, marginLeft: 12, textAlign: "right" },
          amountStyle,
        ]}
      >
        {amount}
      </Text>
    </View>
  );
};
