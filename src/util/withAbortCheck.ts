export class AbortError extends Error {
  constructor() {
    super('Aborted');
  }
}

export default async function withAbortCheck<T>(abortSignal: AbortSignal, cb: Promise<T>): Promise<T> {
  const result = await cb;

  if (abortSignal?.aborted) {
    throw new AbortError();
  }

  return result;
}
