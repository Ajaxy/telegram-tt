export async function yieldToMain() {
  const scheduler = (globalThis as any).scheduler;
  if (scheduler?.yield) {
    return scheduler.yield();
  }

  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
