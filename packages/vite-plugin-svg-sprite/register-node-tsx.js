import * as nodeModule from "node:module"
import { pathToFileURL } from "node:url"

// `@remix-run/node-tsx` (the `remix/node-tsx` loader) registers module.registerHooks
// from its package entry. That API exists on Node 22.15+ and Node 24. Node 20 only
// has module.register, so load the package's async hook module instead. That is the
// same module `loadModule` registers.
if (nodeModule.registerHooks) {
  await import("@remix-run/node-tsx")
} else {
  let require = nodeModule.createRequire(import.meta.url)
  let packageJson = require.resolve("@remix-run/node-tsx/package.json")
  let hooks = new URL("./dist/lib/register-hooks.js", pathToFileURL(packageJson))
  await nodeModule.register(hooks.href, import.meta.url)
}
