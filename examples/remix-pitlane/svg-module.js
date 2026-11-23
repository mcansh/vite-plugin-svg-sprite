import { registerHooks } from "node:module"
import { fileURLToPath } from "node:url"

// Vite turns `*.svg` imports into sprite URLs. Node's test runner does not, so
// this loader stands in for the plugin while `node --test` renders the page.
registerHooks({
  load(url, context, nextLoad) {
    let path = url.split("?")[0] ?? url
    if (!path.startsWith("file:") || !path.endsWith(".svg")) {
      return nextLoad(url, context)
    }

    let file = fileURLToPath(path)
    let slash = file.lastIndexOf("/")
    let name = file.slice(slash + 1, file.length - ".svg".length)
    return {
      format: "module",
      shortCircuit: true,
      source: `export default "/sprite.svg#icon-${name}"\n`,
    }
  },
})
