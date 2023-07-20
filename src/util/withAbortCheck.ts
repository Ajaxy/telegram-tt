export class AbortError extends Error {
  constructor() {
    super('Aborted');
  }
}

export default async function withAbortCheck<T>(abortSignal: AbortSignal, promise: Promise<T>): Promise<T> {
  const result = await promise;

  if (abortSignal?.aborted) {
    throw new AbortError();
  }

  return result;
}
