/** Bound an SDK operation without claiming to cancel its remote side effects. */
export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs = 20_000,
  message = "Le service met trop de temps à répondre. Réessaie dans un instant.",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
