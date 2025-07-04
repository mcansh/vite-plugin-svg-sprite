import fse from "fs-extra";
import { hash } from "hasha";
import path from "node:path";
import * as svgo from "svgo";
import type { Options as SVGStoreOptions } from "svgstore";
import svgstore from "svgstore";
import type { Plugin, ResolvedConfig } from "vite";
import { createLogger } from "vite";

let svgRegex = /\.svg$/;
let PLUGIN_NAME = "@mcansh/vite-plugin-svg-sprite";

let virtualModuleId = `virtual:${PLUGIN_NAME}`;
let resolvedVirtualModuleId = "\0" + virtualModuleId;

let js = String.raw;

export type Config = Partial<{
  spriteOutputName: string;
  symbolId: string;
  /**
   * @deprecated - use Vite's built in --logLevel instead
   * @see https://vite.dev/config/shared-options.html#loglevel
   */
  logging: boolean;
  svgstoreOptions: SVGStoreOptions;
}>;

export function createSvgSpritePlugin(configOptions?: Config): Array<Plugin> {
  let logger = createLogger(configOptions?.logging ? "info" : undefined);
  return [
    {
      name: `${PLUGIN_NAME}:deprecation`,
      buildStart() {
        logger.warnOnce(
          `createSvgSpritePlugin has been renamed to svgSprite, please update your imports as this will be removed in a future release.`,
        );
      },
    },
    ...svgSprite(configOptions),
  ];
}

export let DEFAULT_COPY_ATTRS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
];

export function svgSprite(configOptions?: Config): Array<Plugin> {
  let config: ResolvedConfig;
  let options: Required<Config> = {
    spriteOutputName: "sprite.svg",
    symbolId: "icon-[name]-[hash]",
    logging: false,
    svgstoreOptions: {},
    ...configOptions,
  };

  const logger = createLogger(options.logging ? "info" : undefined);

  if (options.logging) {
    logger.warnOnce(
      `[${PLUGIN_NAME}]: the \`logging\` has been deprecated and will be removed in a future release. Please use Vite's built-in logLevel instead.`,
    );
  }

  let store = svgstore({
    renameDefs: true,
    copyAttrs: DEFAULT_COPY_ATTRS,
    ...options.svgstoreOptions,
  });
  let icons = new Map<string, string>();
  let iconsAdded = new Set<string>();
  let referenceId: string | undefined;

  async function addIconToSprite(id: string, content?: string) {
    if (!content) content = await fse.readFile(id, "utf-8");

    let basename = path.basename(id, ".svg");
    let symbolId = options.symbolId;
    if (options.symbolId.includes("[name]")) {
      symbolId = symbolId.replace("[name]", basename);
    }
    if (options.symbolId.includes("[hash]")) {
      let contentHash = await hash(id);
      symbolId = symbolId.replace("[hash]", contentHash);
    }

    icons.set(symbolId, content);

    return symbolId;
  }

  async function getSpriteHash() {
    let sorted = Array.from(icons).sort((a, b) => {
      return a[0].localeCompare(b[0]);
    });

    for (let [id, content] of sorted) {
      if (iconsAdded.has(id)) continue;
      iconsAdded.add(id);
      store.add(id, content);
    }

    let optimized = svgo.optimize(store.toString(), {
      plugins: [
        {
          name: "preset-default",
          params: {
            overrides: {
              removeHiddenElems: false,
              removeUselessDefs: false,
              cleanupIds: false,
            },
          },
        },
      ],
    });

    let spriteHash = await hash(optimized.data);

    return { data: optimized.data, spriteHash };
  }

  return [
    {
      name: PLUGIN_NAME,
      sharedDuringBuild: true,

      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId;
        }
      },

      async load(id) {
        if (id === resolvedVirtualModuleId) {
          let spriteUrl = `/${config.build.assetsDir}/${options.spriteOutputName}`;
          return js`export default ${JSON.stringify(spriteUrl)}`;
        }
      },

      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },

      async transform(_code, id) {
        if (svgRegex.test(id)) {
          let spriteUrl = `/${config.build.assetsDir}/${options.spriteOutputName}`;
          let symbolId = await addIconToSprite(id);

          return {
            code: js`export default "${spriteUrl}#${symbolId}";`,
            map: { mappings: "" },
          };
        }
      },

      async generateBundle(_, bundle) {
        let { data } = await getSpriteHash();

        referenceId = this.emitFile({
          type: "asset",
          source: data,
          name: options.spriteOutputName,
        });

        if (!referenceId) {
          this.warn(`referenceId not found, skipping`);
          return;
        }

        for (let id in bundle) {
          let chunk = bundle[id];
          if (!chunk) {
            this.warn(`chunk not found for id ${id}, skipping`);
            continue;
          }

          if (chunk.type === "chunk") {
            let referenceFileName = `/${this.getFileName(referenceId)}`;
            let content = chunk.code;
            let currentSpriteUrl = `/${config.build.assetsDir}/${options.spriteOutputName}`;

            this.debug(JSON.stringify({ currentSpriteUrl }));

            // check if content has current sprite url
            let currentSpriteUrlRegex = new RegExp(currentSpriteUrl, "g");
            let matches = content.match(currentSpriteUrlRegex);

            if (!matches) continue;

            let newContent = content.replace(
              currentSpriteUrlRegex,
              referenceFileName,
            );
            this.debug(
              `found current sprite url in file ${chunk.fileName}, replacing with ${referenceFileName}`,
            );

            // write new content to file in a temp location to avoid it being overwritten
            // then compare output sans our changes to the original file
            // if they are the same, we can overwrite the original file
            // if they are different, we can throw an error

            let tempChunkFileName = path.join(config.cacheDir, chunk.fileName);
            await fse.outputFile(tempChunkFileName, newContent);

            this.debug(`wrote to temp file ${tempChunkFileName}`);
          }
        }
      },

      async writeBundle(_, bundle) {
        if (!referenceId) {
          this.warn(`referenceId not found, skipping`);
          return;
        }

        for (let id in bundle) {
          let chunk = bundle[id];
          if (!chunk) {
            this.warn(`chunk not found for id ${id}, skipping`);
            continue;
          }

          // we can skip the svg
          if (svgRegex.test(chunk.fileName)) {
            this.warn(`skipping svg file ${chunk.fileName}`);
            continue;
          }

          // read content of original file and temp file
          // if they are the same sans our changes, we can overwrite the original file
          // if they are different, we can throw an error
          let originalFileName = path.join(
            this.environment.config.build.outDir,
            chunk.fileName,
          );
          let tempFileName = path.join(config.cacheDir, chunk.fileName);

          this.debug(JSON.stringify({ originalFileName, tempFileName }));

          if (!(await fse.pathExists(tempFileName))) {
            continue;
          }

          let originalContent = await fse.readFile(originalFileName, "utf-8");
          let tempContent = await fse.readFile(tempFileName, "utf-8");

          let currentSpriteUrl = `/${config.build.assetsDir}/${options.spriteOutputName}`;
          let currentSpriteUrlRegex = new RegExp(currentSpriteUrl, "g");

          let referenceFileName = `/${this.getFileName(referenceId)}`;
          let referenceFileNameRegex = new RegExp(referenceFileName, "g");

          let originalMatches = originalContent.match(currentSpriteUrlRegex);
          let tempMatches = tempContent.match(referenceFileNameRegex);

          if (!originalMatches || !tempMatches) {
            this.warn(
              `original or temp file does not contain sprite url, skipping`,
            );
            continue;
          }

          // replace the sprite url from the original content again
          // so we can compare the two
          let newOriginalContent = originalContent.replace(
            currentSpriteUrlRegex,
            referenceFileName,
          );

          if (newOriginalContent !== tempContent) {
            this.error(
              `original file ${originalFileName} and temp file ${tempFileName} are different`,
            );

            continue;
          }

          // overwrite the original file
          await fse.outputFile(originalFileName, tempContent);
          this.debug(`overwrote original file ${originalFileName}`);
        }
      },

      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (
            req.url === `/${config.build.assetsDir}/${options.spriteOutputName}`
          ) {
            res.setHeader("Content-Type", "image/svg+xml");

            let { data } = await getSpriteHash();

            return res.end(data);
          }

          return next();
        });
      },
    },
  ];
}
