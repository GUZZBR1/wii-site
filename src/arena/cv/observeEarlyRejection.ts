/** Marks a promise's early rejection observed while preserving it for a later await. */
export function observeEarlyRejection<T>(promise: Promise<T>): Promise<T> {
  void promise.catch(() => undefined);
  return promise;
}
