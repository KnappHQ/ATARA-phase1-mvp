// Shared across screens and service instances in this JavaScript process.
const activeOperations = new Set<string>();

export async function runExclusiveOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (activeOperations.has(key)) {
    throw new Error("An operation is already in progress for this wallet. Wait for its result before retrying.");
  }
  activeOperations.add(key);
  try {
    return await operation();
  } finally {
    activeOperations.delete(key);
  }
}
