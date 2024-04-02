import path from "node:path";
import crypto from "node:crypto";
import fse from "fs-extra";
import svgstore from "svgstore";
import { ResolvedConfig, Plugin } from "vite";

let svgRegex = /\.svg$/;
let store = svgstore();
let icons = new Set<string>();

type Options = {
  spriteOutputName?: string;
  symbolId?: string;
};

let spriteHash: string;
let url: string;

export function createSvgSpritePlugin(options?: Options): Array<Plugin> {
  let config: ResolvedConfig;

  let defaultOptions: Required<Options> = {
    spriteOutputName:
      process.env.NODE_ENV === "development"
        ? "sprite.svg"
        : "sprite-[hash].svg",
    symbolId: "icon-[name]-[hash]",
  };

  let { spriteOutputName, symbolId: symbolIdPattern } = {
    ...defaultOptions,
    ...options,
  };

  return [
    {
      name: "create-svg-sprite-plugin",

      configResolved(resolvedConfig) {
        config = resolvedConfig;
        let { assetsDir } = config.build;
        url = `/${assetsDir}/${spriteOutputName}`;
      },

      async transform(_code, id) {
        if (svgRegex.test(id)) {
          let basename = path.basename(id, ".svg");
          let content = await fse.readFile(id, "utf-8");

          let symbolId = symbolIdPattern;
          if (symbolIdPattern.includes("[name]")) {
            symbolId = symbolId.replace("[name]", basename);
          }
          if (symbolIdPattern.includes("[hash]")) {
            let hash = createHash(content);
            symbolId = symbolId.replace("[hash]", hash);
          }

          // only add the icon if it hasn't been added before
          if (!icons.has(symbolId)) {
            store.add(symbolId, content);
            icons.add(symbolId);
          }

          return {
            code: `export default "${url}#${symbolId}";`,
            map: null,
          };
        }
      },

      async writeBundle() {
        let { assetsDir, outDir } = config.build;
        let sprite = store.toString();
        let hash = createHash(sprite);
        let spriteFilename = spriteOutputName.replace("[hash]", hash);
        let spritePath = path.join(outDir, assetsDir, spriteFilename);
        spriteHash = hash;
        url = `/${assetsDir}/${spriteFilename}`;
        await fse.outputFile(spritePath, sprite);
      },

      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === url) {
            res.setHeader("Content-Type", "image/svg+xml");
            res.end(store.toString());
          } else {
            next();
          }
        });
      },
    },

    {
      name: "create-svg-sprite-plugin-hash",
      apply: "build",

      async transform(code, id) {
        if (svgRegex.test(id)) {
          return {
            code: code.replace("[hash]", spriteHash),
            map: null,
          };
        }
      },
    },
  ];
}

function createHash(content: string): string {
  return crypto
    .createHash("shake256", { outputLength: 4 })
    .update(content)
    .digest("hex");
}
