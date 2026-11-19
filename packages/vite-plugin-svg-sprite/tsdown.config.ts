import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "tsdown"

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const svgstoreReference = '/// <reference path="./svgstore.d.ts" />\n'

async function referenceSvgstoreTypes() {
  for (let name of ["index.d.ts", "index.d.cts"]) {
    let file = path.join(packageDir, "dist", name)
    let source = await readFile(file, "utf8")
    if (source.startsWith(svgstoreReference)) continue
    await writeFile(file, svgstoreReference + source)
  }
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  clean: true,
  dts: true,
  outDir: "dist",
  tsconfig: "tsconfig.json",
  attw: true,
  publint: true,
  async copy() {
    await referenceSvgstoreTypes()
    return ["src/svgstore.d.ts"]
  },
})
