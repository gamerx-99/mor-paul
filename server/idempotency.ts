export function withIdempotency<K, V>(
  cache: Map<K, Promise<V>>,
  handler: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  return async (key: K) => {
    const cached = cache.get(key);
    if (cached) return cached;
    try {
      const promise = handler(key);
      cache.set(key, promise);
      return await promise;
    } catch (error) {
      cache.delete(key);
      throw error;
    }
  };
}
