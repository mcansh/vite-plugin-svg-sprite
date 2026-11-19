import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  fixedExtension: false,
  clean: true,
  dts: true,
  outDir: "dist",
  tsconfig: "tsconfig.json",
  attw: true,
  publint: true,
  banner: { dts: '/// <reference path="./svgstore.d.ts" />' },
  copy: ["src/svgstore.d.ts"],
})
