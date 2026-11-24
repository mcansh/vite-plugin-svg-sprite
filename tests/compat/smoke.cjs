const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const { writeFile } = require("node:fs/promises")
const path = require("node:path")

const { svgSprite } = require("@mcansh/vite-plugin-svg-sprite")

async function main() {
  let icon = path.join(__dirname, "icon.svg")
  let entry = path.join(__dirname, "entry.js")
  await writeFile(
    icon,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>',
  )
  await writeFile(entry, 'import icon from "./icon.svg"; console.log(icon);')

  let { build } = await import("vite")
  let result = await build({
    root: __dirname,
    configFile: false,
    logLevel: "silent",
    plugins: svgSprite(),
    build: { write: false, rollupOptions: { input: entry } },
  })
  let sprite = result.output.find((file) => file.type === "asset" && file.fileName.endsWith(".svg"))
  assert.ok(sprite, "Vite emitted an SVG sprite")
  let symbolId = `icon-icon-${createHash("sha512").update(icon).digest("hex")}`
  assert.ok(
    String(sprite.source).includes(`id="${symbolId}"`),
    "the sprite contains the expected symbol",
  )
  let esmPlugin = await import("@mcansh/vite-plugin-svg-sprite")
  assert.equal(esmPlugin.svgSprite.name, "svgSprite")
  let viteVersion = require("vite/package.json").version
  assert.equal(viteVersion.split(".")[0], process.argv[2])
  console.log(
    `Packed plugin passed the CommonJS and ESM smoke test on ${process.version} with Vite ${viteVersion}.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
