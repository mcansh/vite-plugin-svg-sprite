import assert from "node:assert/strict"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { TestContext } from "node:test"
import { test } from "node:test"
import { pathToFileURL } from "node:url"

import fse from "fs-extra"
import type { InlineConfig } from "vite"
import { build, createBuilder, createLogger } from "vite"

import { svgSprite } from "./index.ts"

type BuildWatcher = Extract<Awaited<ReturnType<typeof build>>, { on: unknown }>

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>'
const entry = `
  import spriteUrl from "virtual:@mcansh/vite-plugin-svg-sprite";
  document.body.innerHTML = '<svg><use href="' + spriteUrl + '#icon-kept" /></svg>';
`

async function createFixture(t: TestContext, files: Record<string, string>) {
  let root = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), "vite-svg-sprite-")))
  t.after(() => fsp.rm(root, { recursive: true, force: true }))

  for (let [name, content] of Object.entries(files)) {
    let file = path.join(root, name)
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, content)
  }

  return {
    config: {
      root,
      configFile: false,
      logLevel: "silent",
      plugins: svgSprite({ symbolId: "icon-[name]" }),
      build: {
        rollupOptions: {
          input: path.join(root, "entry.js"),
          output: { assetFileNames: "[name][extname]" },
        },
      },
    } satisfies InlineConfig,
    readSprite: () => fsp.readFile(path.join(root, "dist/sprite.svg"), "utf8"),
    writeEntry: (code: string) => fsp.writeFile(path.join(root, "entry.js"), code),
  }
}

function nextBuild(watcher: BuildWatcher) {
  return new Promise<void>((resolve, reject) => {
    let onEvent: Parameters<typeof watcher.on<"event">>[1] = (event) => {
      if (event.code === "ERROR") {
        watcher.off("event", onEvent)
        reject(event.error)
      } else if (event.code === "END") {
        watcher.off("event", onEvent)
        resolve()
      }
    }

    watcher.on("event", onEvent)
  })
}

test("build includes icons from side-effect imports and unused eager SVG globs", async (t) => {
  let { config, readSprite } = await createFixture(t, {
    "entry.js": `
      import "./kept.svg";
      import.meta.glob("./glob/*.svg", { eager: true });
      ${entry}
    `,
    "kept.svg": svg,
    "glob/eager.svg": svg,
  })

  await build(config)

  let sprite = await readSprite()
  assert.match(sprite, /id="icon-kept"/)
  assert.match(sprite, /id="icon-eager"/)
})

test("an external SVG stays out of its environment's sprite", async (t) => {
  let { config, readSprite, writeEntry } = await createFixture(t, {
    "kept.svg": svg,
  })
  let svgPath = path.join(config.root, "kept.svg")
  await writeEntry(`import icon from ${JSON.stringify(svgPath)}; console.log(icon);`)
  let builder = await createBuilder({
    ...config,
    environments: {
      client: { consumer: "client" },
      external: {
        consumer: "client",
        build: {
          outDir: "dist-external",
          rollupOptions: { external: [svgPath] },
        },
      },
    },
  })
  let { client, external } = builder.environments
  assert.ok(client && external)

  await builder.build(client)
  assert.match(await readSprite(), /id="icon-kept"/)

  await builder.build(external)
  let sprite = await fsp.readFile(path.join(config.root, "dist-external/sprite.svg"), "utf8")
  assert.doesNotMatch(sprite, /id="icon-kept"/)
})

test("SSR warns and emits a standalone sprite for invalid client build records", async (t) => {
  let { config, readSprite } = await createFixture(t, {
    "entry.js": 'import icon from "./kept.svg"; console.log(icon);',
    "kept.svg": svg,
  })
  let cacheDir = path.join(config.root, "cache")
  let recordDir = path.join(cacheDir, "@mcansh/vite-plugin-svg-sprite")
  let recordPath = path.join(recordDir, "client-build.json")
  let warnings: string[] = []
  let customLogger = createLogger("silent")
  customLogger.warn = (message) => {
    warnings.push(message)
  }
  let ssrConfig = {
    ...config,
    cacheDir,
    customLogger,
    build: { ...config.build, ssr: true, ssrEmitAssets: true },
  } satisfies InlineConfig

  await fsp.mkdir(recordDir, { recursive: true })
  await fsp.writeFile(path.join(recordDir, "existing.svg"), svg)
  await fsp.mkdir(path.join(recordDir, "directory.svg"))
  for (let record of [
    null,
    {
      root: config.root,
      outDir: recordDir,
      spriteFileName: "existing.svg",
      symbolIds: [123, "icon-kept"],
    },
    {
      root: config.root,
      outDir: recordDir,
      spriteFileName: "directory.svg",
      symbolIds: ["icon-kept"],
    },
  ]) {
    await fsp.writeFile(recordPath, JSON.stringify(record))
    warnings.length = 0

    await build(ssrConfig)

    assert.ok(warnings.some((warning) => warning.includes("ignoring invalid")))
    assert.match(await readSprite(), /id="icon-kept"/)
  }
})

test(
  "watch builds keep cached icons and reflect imports added and removed",
  { timeout: 10000 },
  async (t) => {
    let { config, readSprite, writeEntry } = await createFixture(t, {
      "entry.js": `import "./kept.svg"; ${entry}`,
      "kept.svg": svg,
      "added.svg": svg,
    })
    let watcher = await build({
      ...config,
      build: { ...config.build, watch: { watcher: { usePolling: true } } },
    })
    assert.ok("on" in watcher, "Expected a Vite build watcher")
    t.after(() => watcher.close())

    await nextBuild(watcher)
    let sprite = await readSprite()
    assert.match(sprite, /id="icon-kept"/)
    assert.doesNotMatch(sprite, /id="icon-added"/)

    let rebuilt = nextBuild(watcher)
    await writeEntry(`import "./kept.svg"; import "./added.svg"; ${entry}`)
    await rebuilt
    sprite = await readSprite()
    assert.match(sprite, /id="icon-kept"/)
    assert.match(sprite, /id="icon-added"/)

    rebuilt = nextBuild(watcher)
    await writeEntry(`import "./kept.svg"; ${entry}`)
    await rebuilt
    sprite = await readSprite()
    assert.match(sprite, /id="icon-kept"/)
    assert.doesNotMatch(sprite, /id="icon-added"/)
  },
)

function buildEntry(root: string, name: string) {
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: svgSprite({ symbolId: "icon-[name]" }),
    build: {
      ssr: name !== "client",
      outDir: `dist/${name}`,
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: path.join(root, `${name}.js`),
        output: { entryFileNames: `${name}.mjs` },
      },
    },
  })
}

async function assertServerIconsAreServed(root: string, name: string) {
  let { hrefs } = await import(pathToFileURL(path.join(root, `dist/${name}/${name}.mjs`)).href)

  for (let href of hrefs) {
    let [url, symbolId] = href.split("#")
    let sprite = await fsp.readFile(path.join(root, "dist/client", url), "utf8")
    assert.ok(sprite.includes(`id="${symbolId}"`), `${url} has no symbol ${symbolId}`)
  }
}

async function findTempFiles(root: string) {
  let files = await fsp.readdir(path.join(root, "dist/client/assets"))
  return files.filter((file) => file.endsWith(".tmp"))
}

const sharedServerIcon = {
  "client.js": 'import kept from "./kept.svg"; console.log(kept);',
  "a.js":
    'import kept from "./kept.svg"; import only from "./only.svg"; export let hrefs = [kept, only];',
  "b.js": 'import only from "./only.svg"; export let hrefs = [only];',
  "kept.svg": svg,
  "only.svg": svg,
}

test("parallel server builds can share a server-only icon", { timeout: 30000 }, async (t) => {
  let { config } = await createFixture(t, sharedServerIcon)
  await buildEntry(config.root, "client")

  // make both builds copy in the same millisecond, before either one publishes
  t.mock.method(Date, "now", () => 0)
  let copy = fse.copy
  let tempFiles: string[] = []
  let release = () => {}
  let bothCopied = new Promise<void>((resolve) => {
    release = resolve
  })
  t.mock.method(fse, "copy", async (source: string, destination: string) => {
    await copy(source, destination).finally(() => {
      tempFiles.push(destination)
      if (tempFiles.length === 2) release()
      return bothCopied
    })
  })

  let results = await Promise.allSettled([
    buildEntry(config.root, "a"),
    buildEntry(config.root, "b"),
  ])

  // renaming the same file twice only fails on some platforms, so check the paths themselves
  assert.equal(new Set(tempFiles).size, 2, "both builds copied to the same temp file")

  assert.deepEqual(
    results.flatMap((result) => (result.status === "rejected" ? [String(result.reason)] : [])),
    [],
  )
  await assertServerIconsAreServed(config.root, "a")
  await assertServerIconsAreServed(config.root, "b")
  assert.deepEqual(await findTempFiles(config.root), [])
})

test("a server build accepts a sprite that another build published first", async (t) => {
  let { config } = await createFixture(t, sharedServerIcon)
  await buildEntry(config.root, "client")

  // Windows can refuse to replace a file that another build just put in place
  let loseRace = async (temp: string, target: string) => {
    await fsp.copyFile(temp, target)
    throw Object.assign(new Error("operation not permitted"), { code: "EPERM" })
  }
  t.mock.method(fse, "rename", loseRace)
  t.mock.method(fse, "move", loseRace)

  await buildEntry(config.root, "a")

  await assertServerIconsAreServed(config.root, "a")
  assert.deepEqual(await findTempFiles(config.root), [])
})

test("a failed sprite copy fails the build and removes its temp file", async (t) => {
  let { config } = await createFixture(t, sharedServerIcon)
  await buildEntry(config.root, "client")

  let fail = async () => {
    throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" })
  }
  t.mock.method(fse, "rename", fail)
  t.mock.method(fse, "move", fail)

  await assert.rejects(buildEntry(config.root, "a"), /no space left on device/)
  assert.deepEqual(await findTempFiles(config.root), [])
})

for (let name of ["arrow left", "logo (1)", "it's", "a`b"]) {
  test(`server URLs find the sprite of a shared icon named ${name}`, async (t) => {
    let { config } = await createFixture(t, {
      "client.js": `import shared from "./${name}.svg"; console.log(shared);`,
      "a.js": `import shared from "./${name}.svg"; import only from "./only.svg"; export let hrefs = [shared, only];`,
      [`${name}.svg`]: svg,
      "only.svg": svg,
    })

    await buildEntry(config.root, "client")
    await buildEntry(config.root, "a")

    await assertServerIconsAreServed(config.root, "a")
  })
}

test("server URLs tell apart ids that start with another icon's id", async (t) => {
  let { config } = await createFixture(t, {
    "client.js": 'import arrow from "./arrow.svg"; console.log(arrow);',
    "a.js":
      'import arrow from "./arrow.svg"; import left from "./arrow left.svg"; export let hrefs = [arrow, left];',
    "arrow.svg": svg,
    "arrow left.svg": svg,
  })

  await buildEntry(config.root, "client")
  await buildEntry(config.root, "a")

  await assertServerIconsAreServed(config.root, "a")
})

for (let separator of ["-", ".", "@", "+", ",", "한"]) {
  test(`a known id doesn't claim a longer id continued with ${separator} at runtime`, async (t) => {
    let { config } = await createFixture(t, {
      "client.js": 'import arrow from "./arrow.svg"; console.log(arrow);',
      // what a bundler leaves after folding `spriteUrl + "#icon-arrow." + direction`
      "a.js": `
        import "./arrow${separator}left.svg";
        export let hrefs = ["/assets/sprite.svg#icon-arrow${separator}" + (globalThis.direction ?? "left")];
      `,
      "arrow.svg": svg,
      [`arrow${separator}left.svg`]: svg,
    })

    await buildEntry(config.root, "client")
    await buildEntry(config.root, "a")

    await assertServerIconsAreServed(config.root, "a")
  })
}
