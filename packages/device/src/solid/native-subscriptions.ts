/** Acquire native listeners transactionally and release every listener, even after one fails. */
export function nativeSubscriptions(factories: readonly (() => { remove(): void })[]): () => void {
  const subscriptions: { remove(): void }[] = [];
  let active = true;
  const stop = () => {
    if (!active) return;
    active = false;
    const errors: unknown[] = [];
    for (const subscription of subscriptions) {
      try {
        subscription.remove();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Native listener cleanup failed.');
  };
  try {
    for (const create of factories) subscriptions.push(create());
  } catch (error) {
    try {
      stop();
    } catch {
      // The setup failure remains the cause reported to the caller.
    }
    throw error;
  }
  return stop;
}
