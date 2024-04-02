import path from "node:path";
import crypto from "node:crypto";
import fse from "fs-extra";
import svgstore from "svgstore";
import { ResolvedConfig, Plugin } from "vite";

let svgRegex = /\.svg$/;
let store = svgstore();

type Options = {
  spriteOutputName?: string;
  symbolId?: string;
};

let defaultOptions: Required<Options> = {
  spriteOutputName: "sprite.svg",
  symbolId: "icon-[name]-[hash]",
};

export function createSvgSpritePlugin(options?: Options): Plugin {
  let config: ResolvedConfig;

  let { spriteOutputName, symbolId: symbolIdPattern } = {
    ...defaultOptions,
    ...options,
  };

  return {
    name: "create-svg-sprite-plugin",

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async transform(_code, id) {
      if (svgRegex.test(id)) {
        let basename = path.basename(id, ".svg");
        if (basename === "sprite") return null;
        let content = await fse.readFile(id, "utf-8");

        let hash = crypto
          .createHash("shake256", { outputLength: 4 })
          .update(content)
          .digest("hex");

        let symbolId: string;
        if (symbolIdPattern) {
          if (symbolIdPattern.includes("[name]")) {
            symbolIdPattern = symbolIdPattern.replace("[name]", basename);
          }
          if (symbolIdPattern.includes("[hash]")) {
            symbolIdPattern = symbolIdPattern.replace("[hash]", hash);
          }
          symbolId = symbolIdPattern;
        } else {
          symbolId = `icon-${basename}-${hash}`;
        }

        store.add(symbolId, content);

        return {
          code: `export default "/${config.build.assetsDir}/${spriteOutputName}#${symbolId}";`,
          map: null,
        };
      }
    },

    async writeBundle() {
      let { assetsDir, outDir } = config.build;
      let sprite = store.toString();
      let spritePath = path.join(outDir, assetsDir, spriteOutputName);
      await fse.outputFile(spritePath, sprite);
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === `/assets/${spriteOutputName}`) {
          res.setHeader("Content-Type", "image/svg+xml");
          res.end(store.toString());
        } else {
          next();
        }
      });
    },
  };
}
