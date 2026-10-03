import { registerHooks } from 'node:module';

// Test the app through public native entries; a React wrapper reaching the Solid
// runtime is a failure, not a fallback.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(?:react$|react\/|react-native$|react-native\/|solid-js\/web(?:$|\/))/.test(specifier))
      throw new Error(`A Solid notes runtime imported a forbidden wrapper: ${specifier}`);
    return nextResolve(specifier, context);
  },
});
