export type Nicknames = Record<string, string>;

export interface AddressBooks {
  /** One book per ATARA account that signed in on this phone. */
  books: Record<string, Nicknames>;
  /**
   * Nicknames saved before books were kept per account. They go to the first
   * account that opens its book after the update, which on nearly every phone
   * is the only account that ever used it.
   */
  legacy: Nicknames | null;
}

export const openBook = (
  state: AddressBooks,
  userId: string,
): AddressBooks & { contacts: Nicknames } => {
  if (!state.legacy || state.books[userId]) {
    return { ...state, contacts: state.books[userId] ?? {} };
  }
  const claimed = { ...state.legacy };
  return {
    books: { ...state.books, [userId]: claimed },
    legacy: null,
    contacts: claimed,
  };
};

export const forgetBook = (state: AddressBooks, userId: string): AddressBooks => {
  const books = { ...state.books };
  delete books[userId];
  return { books, legacy: state.legacy };
};

/** Version 0 stored one book for the whole phone as `contacts`. */
export const migrateAddressBooks = (
  persisted: unknown,
  version: number,
): AddressBooks => {
  const stored = (persisted ?? {}) as Partial<AddressBooks> & {
    contacts?: Nicknames;
  };
  if (version < 1) {
    const contacts = stored.contacts ?? {};
    return {
      books: {},
      legacy: Object.keys(contacts).length ? contacts : null,
    };
  }
  return { books: stored.books ?? {}, legacy: stored.legacy ?? null };
};
