export async function executeWriteWithReconciliation(
  write: () => Promise<void>,
  refresh: () => Promise<unknown>,
): Promise<void> {
  try {
    await write();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "UNKNOWN_RESULT") throw error;
    await refresh();
    throw error;
  }
}
