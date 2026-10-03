import { registerHooks } from 'node:module';

// The Solid app must reach native only through the public Solid entries: no React.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(?:react$|react\/|react-native$|react-native\/|solid-js\/web(?:$|\/))/.test(specifier))
      throw new Error(`The Solid runs app imported a forbidden wrapper: ${specifier}`);
    return nextResolve(specifier, context);
  },
});
