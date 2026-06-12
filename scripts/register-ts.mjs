// Lets Node run our extension-less TypeScript imports (`./rules` →
// `./rules.ts`) so dev scripts can reuse src/lib modules directly.
// Usage: node --import ./scripts/register-ts.mjs <script>
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
