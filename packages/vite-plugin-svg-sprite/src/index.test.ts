import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { test } from "node:test";
import type { InlineConfig } from "vite";
import { build, createBuilder, createLogger } from "vite";
import { svgSprite } from "./index.ts";

type BuildWatcher = Extract<Awaited<ReturnType<typeof build>>, { on: unknown }>;

let svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
let entry = `
  import spriteUrl from "virtual:@mcansh/vite-plugin-svg-sprite";
  document.body.innerHTML = '<svg><use href="' + spriteUrl + '#icon-kept" /></svg>';
`;

async function createFixture(t: TestContext, files: Record<string, string>) {
  let root = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), "vite-svg-sprite-")),
  );
  t.after(() => fsp.rm(root, { recursive: true, force: true }));

  for (let [name, content] of Object.entries(files)) {
    let file = path.join(root, name);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, content);
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
    writeEntry: (code: string) =>
      fsp.writeFile(path.join(root, "entry.js"), code),
  };
}

function nextBuild(watcher: BuildWatcher) {
  return new Promise<void>((resolve, reject) => {
    let onEvent: Parameters<typeof watcher.on<"event">>[1] = (event) => {
      if (event.code === "ERROR") {
        watcher.off("event", onEvent);
        reject(event.error);
      } else if (event.code === "END") {
        watcher.off("event", onEvent);
        resolve();
      }
    };

    watcher.on("event", onEvent);
  });
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
  });

  await build(config);

  let sprite = await readSprite();
  assert.match(sprite, /id="icon-kept"/);
  assert.match(sprite, /id="icon-eager"/);
});

test("an external SVG stays out of its environment's sprite", async (t) => {
  let { config, readSprite, writeEntry } = await createFixture(t, {
    "kept.svg": svg,
  });
  let svgPath = path.join(config.root, "kept.svg");
  await writeEntry(
    `import icon from ${JSON.stringify(svgPath)}; console.log(icon);`,
  );
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
  });
  let { client, external } = builder.environments;
  assert.ok(client && external);

  await builder.build(client);
  assert.match(await readSprite(), /id="icon-kept"/);

  await builder.build(external);
  let sprite = await fsp.readFile(
    path.join(config.root, "dist-external/sprite.svg"),
    "utf8",
  );
  assert.doesNotMatch(sprite, /id="icon-kept"/);
});

test("SSR warns and emits a standalone sprite for invalid client build records", async (t) => {
  let { config, readSprite } = await createFixture(t, {
    "entry.js": 'import icon from "./kept.svg"; console.log(icon);',
    "kept.svg": svg,
  });
  let cacheDir = path.join(config.root, "cache");
  let recordDir = path.join(cacheDir, "@mcansh/vite-plugin-svg-sprite");
  let recordPath = path.join(recordDir, "client-build.json");
  let warnings: string[] = [];
  let customLogger = createLogger("silent");
  customLogger.warn = (message) => {
    warnings.push(message);
  };
  let ssrConfig = {
    ...config,
    cacheDir,
    customLogger,
    build: { ...config.build, ssr: true, ssrEmitAssets: true },
  } satisfies InlineConfig;

  await fsp.mkdir(recordDir, { recursive: true });
  await fsp.writeFile(path.join(recordDir, "existing.svg"), svg);
  for (let record of [
    null,
    {
      root: config.root,
      outDir: recordDir,
      spriteFileName: "existing.svg",
      symbolIds: [123, "icon-kept"],
    },
  ]) {
    await fsp.writeFile(recordPath, JSON.stringify(record));
    warnings.length = 0;

    await build(ssrConfig);

    assert.ok(warnings.some((warning) => warning.includes("ignoring invalid")));
    assert.match(await readSprite(), /id="icon-kept"/);
  }
});

test(
  "watch builds keep cached icons and reflect imports added and removed",
  { timeout: 10000 },
  async (t) => {
    let { config, readSprite, writeEntry } = await createFixture(t, {
      "entry.js": `import "./kept.svg"; ${entry}`,
      "kept.svg": svg,
      "added.svg": svg,
    });
    let watcher = await build({
      ...config,
      build: { ...config.build, watch: { chokidar: { usePolling: true } } },
    });
    assert.ok("on" in watcher, "Expected a Vite build watcher");
    t.after(() => watcher.close());

    await nextBuild(watcher);
    let sprite = await readSprite();
    assert.match(sprite, /id="icon-kept"/);
    assert.doesNotMatch(sprite, /id="icon-added"/);

    let rebuilt = nextBuild(watcher);
    await writeEntry(`import "./kept.svg"; import "./added.svg"; ${entry}`);
    await rebuilt;
    sprite = await readSprite();
    assert.match(sprite, /id="icon-kept"/);
    assert.match(sprite, /id="icon-added"/);

    rebuilt = nextBuild(watcher);
    await writeEntry(`import "./kept.svg"; ${entry}`);
    await rebuilt;
    sprite = await readSprite();
    assert.match(sprite, /id="icon-kept"/);
    assert.doesNotMatch(sprite, /id="icon-added"/);
  },
);
