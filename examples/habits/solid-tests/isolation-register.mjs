import { registerHooks } from 'node:module';

// Test the app through public native entries: no React or React Native may load.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(?:react$|react\/|react-native$|react-native\/|solid-js\/web(?:$|\/))/.test(specifier))
      throw new Error(`A Solid habits runtime imported a forbidden wrapper: ${specifier}`);
    return nextResolve(specifier, context);
  },
});
