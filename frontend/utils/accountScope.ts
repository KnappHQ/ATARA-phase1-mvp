// Shared without importing auth stores into data stores (avoids import cycles).
let revision = 0;
const resets = new Set<() => void>();
export const accountRevision = () => revision;
export const onAccountReset = (reset: () => void) => { resets.add(reset); };
export const resetAccountScope = () => {
  revision += 1;
  resets.forEach(reset => reset());
};
