import path from "node:path";

import fse from "fs-extra";
import svgstore from "svgstore";
import { ResolvedConfig, Plugin } from "vite";
import { hash } from "hasha";
import svgo from "svgo";

import pkgJson from "../package.json" assert { type: "json" };

let svgRegex = /\.svg$/;
let PLUGIN_NAME = pkgJson.name;

let virtualModuleId = `virtual:${PLUGIN_NAME}`;
let resolvedVirtualModuleId = "\0" + virtualModuleId;

let js = String.raw;

type Config = {
  spriteOutputName?: string;
  symbolId?: string;
};

let store = svgstore({
  // use file name in symbol defs
  renameDefs: true,
  copyAttrs: [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
  ],
});
let icons = new Set<string>();
let referenceId: string | undefined;

export function createSvgSpritePlugin(configOptions?: Config): Array<Plugin> {
  let config: ResolvedConfig;
  let options: Required<Config> = {
    spriteOutputName: "sprite-[hash].svg",
    symbolId: "icon-[name]-[hash]",
    ...configOptions,
  };

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

    // only add the icon if it hasn't been added before
    if (!icons.has(symbolId)) {
      store.add(symbolId, content);
      icons.add(symbolId);
    }

    return symbolId;
  }

  async function getSpriteHash() {
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

      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId;
        }
      },

      buildStart(options) {
        console.log(`[vite-svg-sprite-plugin]`, `build started`);
      },

      async buildEnd() {
        console.log(`[vite-svg-sprite-plugin]`, `build ended`);

        let { data } = await getSpriteHash();

        referenceId = this.emitFile({
          type: "asset",
          source: data,
          name: "sprite.svg",
        });
      },

      async load(id) {
        if (id === resolvedVirtualModuleId) {
          console.warn(`[vite-svg-sprite-plugin]`, `temporarily deprecated`);
          return js`export default "";`;
        }

        if (id.endsWith(".svg")) {
          console.log(`[vite-svg-sprite-plugin]`, `loading`, id);
          let symbolId = await addIconToSprite(id);
          let { data } = await getSpriteHash();

          referenceId = this.emitFile({
            type: "asset",
            source: data,
            name: "sprite.svg",
          });

          return js`export default import.meta.ROLLUP_FILE_URL_${referenceId}#${symbolId};`;
        }
      },

      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },

      async transform(_code, id) {
        if (svgRegex.test(id)) {
          console.log(`[vite-svg-sprite-plugin]`, `transforming`, id);

          let spriteUrl = `/${config.build.assetsDir}/sprite.svg`;

          let symbolId = await addIconToSprite(id);

          return {
            code: js`export default "${spriteUrl}#${symbolId}";`,
            map: { mappings: "" },
          };
        }
      },

      async generateBundle(_, bundle) {
        console.log(`[vite-svg-sprite-plugin]`, `generating bundle`);

        console.log({ referenceId });

        if (!referenceId) {
          console.warn(
            `[vite-svg-sprite-plugin]`,
            `referenceId not found, skipping`
          );
          return;
        }

        for (let id in bundle) {
          let chunk = bundle[id];
          if (!chunk) {
            console.warn(
              `[vite-svg-sprite-plugin]`,
              `chunk not found for id ${id}, skipping`
            );
            continue;
          }
          console.log(`[vite-svg-sprite-plugin]`, chunk.type, chunk.fileName);
          if (chunk.type === "chunk") {
            console.log({ referenceId });

            if (!referenceId) {
              console.warn(
                `[vite-svg-sprite-plugin]`,
                `referenceId not found, skipping`
              );
              continue;
            }

            let referenceFileName = `/${this.getFileName(referenceId)}`;

            let content = chunk.code;
            let chunkFileName = path.join(config.build.outDir, chunk.fileName);

            let currentSpriteUrl = `/${config.build.assetsDir}/sprite.svg`;

            console.log({ currentSpriteUrl });

            // check if content has current sprite url
            let currentSpriteUrlRegex = new RegExp(currentSpriteUrl, "g");
            let matches = content.match(currentSpriteUrlRegex);

            if (!matches) {
              console.warn(
                `[vite-svg-sprite-plugin]`,
                `current sprite url not found in file ${chunk.fileName}, skipping`
              );
              continue;
            }

            let newContent = content.replace(
              currentSpriteUrlRegex,
              referenceFileName
            );
            console.log(
              `[vite-svg-sprite-plugin]`,
              `found current sprite url in file ${chunk.fileName}`
            );

            // write new content to file in a temp location to avoid it being overwritten
            // then compare output sans our changes to the original file
            // if they are the same, we can overwrite the original file
            // if they are different, we can throw an error

            let tempChunkFileName = path.join(config.cacheDir, chunk.fileName);
            await fse.outputFile(tempChunkFileName, newContent);

            console.log(
              `[vite-svg-sprite-plugin]`,
              `wrote to temp file ${tempChunkFileName}`
            );
          }
        }
      },

      async writeBundle(_, bundle) {
        console.log(`[vite-svg-sprite-plugin]`, `writing bundle`);

        for (let id in bundle) {
          let chunk = bundle[id];
          if (!chunk) {
            console.warn(
              `[vite-svg-sprite-plugin]`,
              `chunk not found for id ${id}, skipping`
            );
            continue;
          }

          // we can skip the svg
          if (svgRegex.test(chunk.fileName)) {
            console.warn(
              `[vite-svg-sprite-plugin]`,
              `skipping svg file ${chunk.fileName}`
            );
            continue;
          }

          // read content of original file and temp file
          // if they are the same sans our changes, we can overwrite the original file
          // if they are different, we can throw an error
          let originalFileName = path.join(config.build.outDir, chunk.fileName);
          let tempFileName = path.join(config.cacheDir, chunk.fileName);

          console.log({ originalFileName, tempFileName });

          if (!(await fse.pathExists(tempFileName))) {
            console.warn(
              `[vite-svg-sprite-plugin]`,
              `temp file not found for ${chunk.fileName}, skipping`
            );
            continue;
          }

          let originalContent = await fse.readFile(originalFileName, "utf-8");
          let tempContent = await fse.readFile(tempFileName, "utf-8");

          if (originalContent === tempContent) {
            // content is the same, no need to overwrite
          } else {
            // check if the only changes are ones we made earlier
            // if so, we can overwrite the original file
            // if not, we should throw an error
            let currentSpriteUrl = `/${config.build.assetsDir}/sprite.svg`;
            let currentSpriteUrlRegex = new RegExp(currentSpriteUrl, "g");

            if (!referenceId) {
              console.warn(
                `[vite-svg-sprite-plugin]`,
                `referenceId not found, skipping`
              );
              continue;
            }

            let referenceFileName = `/${this.getFileName(referenceId)}`;
            let referenceFileNameRegex = new RegExp(referenceFileName, "g");

            let originalMatches = originalContent.match(currentSpriteUrlRegex);
            let tempMatches = tempContent.match(referenceFileNameRegex);

            if (!originalMatches || !tempMatches) {
              console.warn(
                `[vite-svg-sprite-plugin]`,
                `original or temp file does not contain sprite url, skipping`
              );
              continue;
            }

            // replace the sprite url from the original content again
            // so we can compare the two
            let newOriginalContent = originalContent.replace(
              currentSpriteUrlRegex,
              referenceFileName
            );

            if (newOriginalContent !== tempContent) {
              console.error(
                `[vite-svg-sprite-plugin]`,
                `original file ${originalFileName} and temp file ${tempFileName} are different`
              );

              continue;
            }

            // overwrite the original file
            await fse.outputFile(originalFileName, tempContent);
            console.log(
              `[vite-svg-sprite-plugin]`,
              `overwrote original file ${originalFileName}`
            );
          }
        }
      },
    },
  ];
}
