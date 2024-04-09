import path from "node:path";

import fse from "fs-extra";
import svgstore from "svgstore";
import { ResolvedConfig, Plugin } from "vite";
import { hash } from "hasha";
import svgo from "svgo";

let svgRegex = /\.svg$/;
let PLUGIN_NAME = "vite-svg-sprite-plugin";
let virtualModuleId = `virtual:${PLUGIN_NAME}`;
let resolvedVirtualModuleId = "\0" + virtualModuleId;

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

export function createSvgSpritePlugin(configOptions?: Config): Array<Plugin> {
  let config: ResolvedConfig;
  let options: Required<Config> = {
    spriteOutputName: "sprite-[hash].svg",
    symbolId: "icon-[name]-[hash]",
    ...configOptions,
  };

  return [
    {
      name: PLUGIN_NAME,

      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },

      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId;
        }
      },

      async load(id) {
        if (id === resolvedVirtualModuleId) {
          let url = `/${config.build.assetsDir}/${options.spriteOutputName}`;
          let sprite = store.toString();
          let { spriteHash } = await getSpriteHash(sprite);
          url = url.replace("[hash]", spriteHash);
          return `export default "${url}";`;
        }
      },

      config(userConfig) {
        return {
          build: {
            assetsInlineLimit(filePath, content) {
              // don't inline svg files
              if (svgRegex.test(filePath)) {
                return true;
              }

              if (typeof userConfig.build?.assetsInlineLimit === "function") {
                return userConfig.build.assetsInlineLimit(filePath, content);
              }

              // check buffer length in bytes (default is 4096) and return true if it's less than the limit
              return content.length < 4096;
            },
          },
        };
      },

      async transform(_code, id) {
        if (svgRegex.test(id)) {
          let basename = path.basename(id, ".svg");
          let content = await fse.readFile(id, "utf-8");

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

          let url = `/${config.build.assetsDir}/${options.spriteOutputName}`;
          return {
            code: `export default "${url}#${symbolId}";`,
            map: null,
          };
        }
      },

      async generateBundle() {
        let { assetsDir } = config.build;
        let sprite = store.toString();
        let { data, spriteHash } = await getSpriteHash(sprite);

        let outputFile = options.spriteOutputName.includes("[hash]")
          ? options.spriteOutputName.replace("[hash]", spriteHash)
          : options.spriteOutputName;

        let outputFileName = path.join(assetsDir, outputFile);

        this.emitFile({
          source: data,
          fileName: outputFileName,
          name: "sprite.svg",
          type: "asset",
        });
      },

      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          let url = `/${config.build.assetsDir}/${options.spriteOutputName}`;
          let sprite = store.toString();
          let { spriteHash, data } = await getSpriteHash(sprite);
          url = url.replace("[hash]", spriteHash);

          if (!req.url) {
            throw new Error("req.url is undefined");
          }

          if (req.url === url) {
            res.setHeader("Content-Type", "image/svg+xml");
            res.end(data);
          } else {
            next();
          }
        });
      },
    },

    // re-transform each imported svg to inject the hash
    {
      name: `${PLUGIN_NAME}:transform`,
      enforce: "post",
      async transform(code, id) {
        if (svgRegex.test(id)) {
          let sprite = store.toString();

          let { spriteHash } = await getSpriteHash(sprite);

          return {
            code: code.replace("[hash]", spriteHash),
            map: null,
          };
        }
      },
    },
  ];
}

async function getSpriteHash(sprite: string) {
  let optimized = svgo.optimize(sprite, {
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
