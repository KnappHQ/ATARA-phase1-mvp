/**
 * How a payment row is laid out, decided from the phone, not from the text.
 *
 * A row shows three things that all want the same line: who (a name or @handle),
 * where (a wallet address) and how much. Squeezing them onto one line is what
 * made them run into each other on a small phone, with a long name, or with the
 * text size turned up. Each has its own zone instead:
 *
 *   [ name / @handle          ]  [ amount ]     identity zone shrinks, amount never overlaps it
 *   [ 0x5999…204c             ]                 the address has its own line
 *   [ note                    ]  [ date   ]
 *
 * Where there is not room for the amount beside the name, it moves below it.
 */

/** Text size multiplier (iOS "Larger Text") from which the amount goes under the name. */
export const STACK_FROM_FONT_SCALE = 1.25;
/** Screen width, in points, below which the amount goes under the name. iPhone SE is 375. */
export const STACK_BELOW_WIDTH = 350;
/** Rows never grow their text past this multiple, so one row cannot fill the screen. */
export const MAX_ROW_FONT_MULTIPLIER = 1.6;

export interface RowLayout {
  /** Amount under the name instead of beside it. */
  stacked: boolean;
  /** The widest share of the row the amount may take when it is beside the name. */
  amountMaxWidth: `${number}%`;
}

export const rowLayout = (fontScale: number, width: number): RowLayout => ({
  stacked: fontScale >= STACK_FROM_FONT_SCALE || width < STACK_BELOW_WIDTH,
  amountMaxWidth: "45%",
});
