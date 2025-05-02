import path from "node:path";

import fse from "fs-extra";
import { hash } from "hasha";
import svgo from "svgo";
import type { Options as SVGStoreOptions } from "svgstore";
import svgstore from "svgstore";
import type { Plugin, ResolvedConfig } from "vite";

let svgRegex = /\.svg$/;
let PLUGIN_NAME = "@mcansh/vite-plugin-svg-sprite";

let virtualModuleId = `virtual:${PLUGIN_NAME}`;
let resolvedVirtualModuleId = "\0" + virtualModuleId;

let js = String.raw;

export type Config = {
  spriteOutputName?: string;
  symbolId?: string;
  logging?: boolean;
  svgstoreOptions?: SVGStoreOptions;
};

/**
 * @deprecated - `createSvgSpritePlugin has been renamed to svgSprite, please update your imports as this will be removed in a future release.`
 */
export function createSvgSpritePlugin(configOptions?: Config): Array<Plugin> {
  console.warn(
    `createSvgSpritePlugin has been renamed to svgSprite, please update your imports as this will be removed in a future release.`,
  );

  return svgSprite(configOptions);
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
      name: `${PLUGIN_NAME}:resolve`,

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

      async buildEnd() {
        let { data } = await getSpriteHash();

        referenceId = this.emitFile({
          type: "asset",
          source: data,
          name: options.spriteOutputName,
        });
      },
    },

    {
      name: `${PLUGIN_NAME}:client`,
      transform(_code, id) {
        console.log({id, referenceId});
        if (id === `/${config.build.assetsDir}/${options.spriteOutputName}`) {

          return {
            code: `export default "import.meta.ROLLUP_FILE_URL_referenceId";`,
            map: { mappings: "" },
          };
        }
      }
    },
    {
      name: `${PLUGIN_NAME}:dev`,
      apply: 'serve',
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
    }
  ];
}
