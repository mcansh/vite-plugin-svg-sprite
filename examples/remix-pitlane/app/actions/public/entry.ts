import { revalidate } from "pitlane/vite-plugin-remix/hmr"
import { run } from "remix/component"

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(/* @vite-ignore */ moduleUrl)
    let exported = mod[exportName]
    if (!(exported instanceof Function)) {
      throw new TypeError(`Expected export '${exportName}' from '${moduleUrl}' to be a function`)
    }
    return exported
  },
})

if (import.meta.hot) {
  import.meta.hot.on("server:update", () => revalidate(app))
}

await app.ready()
