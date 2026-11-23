import { relative } from "node:path"
import { fileURLToPath } from "node:url"

import { createAssetResolver } from "pitlane/assets"
import { createAssetManifest } from "pitlane/assets/build"
import viteManifest from "pitlane/assets/manifest"

// `node --test` imports this module without Vite, so the published manifest is
// unavailable. Dev and production builds replace it with the real one.
function testManifest() {
  return createAssetManifest({
    base: "/",
    importMap: { imports: { "test:entry": "/test-entry.js" } },
    environments: {
      client: {
        role: "client",
        chunks: {
          entry: {
            file: "test-entry.js",
            modules: ["app/actions/public/entry.ts"],
            imports: [],
            dynamicImports: [],
            stylesheets: ["test-global.css"],
          },
          plus: {
            file: "test-plus.js",
            modules: ["app/actions/public/plus-button.tsx"],
            imports: [],
            dynamicImports: [],
            stylesheets: [],
          },
        },
        entries: {
          "app/actions/public/entry.ts": "entry",
          "app/actions/public/plus-button.tsx": "plus",
        },
        assets: { "app/actions/public/global.css": "test-global.css" },
      },
      ssr: {
        role: "server",
        chunks: {
          server: {
            file: "ssr.js",
            modules: ["app/entry.server.tsx"],
            imports: [],
            dynamicImports: [],
            stylesheets: [],
          },
        },
        entries: {},
        assets: {},
      },
    },
  })
}

const root = fileURLToPath(new URL("..", import.meta.url))

// Client components pass `import.meta.url`. Vite rewrites that to a project key.
// The test runner leaves an absolute file URL, which the resolver rejects.
function projectKey(path: string) {
  if (!path.startsWith("file:")) return path
  let key = relative(root, fileURLToPath(path))
  if (key.startsWith("..")) return path
  return key
}

function isList(paths: string | readonly string[]): paths is readonly string[] {
  return Array.isArray(paths)
}

const resolved = createAssetResolver(
  viteManifest.mode === "unavailable" ? testManifest() : viteManifest,
)

export const assets = {
  getScriptEntry(path: string) {
    return resolved.getScriptEntry(projectKey(path))
  },
  getHref(path: string) {
    return resolved.getHref(projectKey(path))
  },
  getPreloads(paths: string | readonly string[]) {
    if (isList(paths)) return resolved.getPreloads(paths.map((path) => projectKey(path)))
    return resolved.getPreloads(projectKey(paths))
  },
  getStylesheets(paths: string | readonly string[]) {
    if (isList(paths)) return resolved.getStylesheets(paths.map((path) => projectKey(path)))
    return resolved.getStylesheets(projectKey(paths))
  },
  getImportMap(paths: string | readonly string[]) {
    if (isList(paths)) return resolved.getImportMap(paths.map((path) => projectKey(path)))
    return resolved.getImportMap(projectKey(paths))
  },
}

// These calls stay on the resolver Vite scans, so the entry and stylesheet
// are registered as browser inputs.
export const scriptEntry = await resolved.getScriptEntry("app/actions/public/entry.ts")
export const stylesheetHref = await resolved.getHref("app/actions/public/global.css")
