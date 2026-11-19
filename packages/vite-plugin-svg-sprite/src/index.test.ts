import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { build, type InlineConfig } from "vite";
import { svgSprite } from "../dist/index.js";

type BuildWatcher = Extract<Awaited<ReturnType<typeof build>>, { on: unknown }>;

let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
let entry = `
  import spriteUrl from "virtual:@mcansh/vite-plugin-svg-sprite";
  document.body.innerHTML = '<svg><use href="' + spriteUrl + '#icon-kept" /></svg>';
`;

async function createFixture(t: TestContext, files: Record<string, string>) {
  let root = await mkdtemp(path.join(tmpdir(), "vite-svg-sprite-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  for (let [name, content] of Object.entries(files)) {
    let file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
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
    readSprite: () => readFile(path.join(root, "dist/sprite.svg"), "utf8"),
    writeEntry: (code: string) => writeFile(path.join(root, "entry.js"), code),
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
