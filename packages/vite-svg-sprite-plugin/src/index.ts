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

let defaultOptions: Required<Options> = {
  spriteOutputName: "sprite.svg",
  symbolId: "icon-[name]-[hash]",
};

export function createSvgSpritePlugin(options?: Options): Plugin {
  let config: ResolvedConfig;
  let url: string;

  let { spriteOutputName, symbolId: symbolIdPattern } = {
    ...defaultOptions,
    ...options,
  };

  return {
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

        let hash = crypto
          .createHash("shake256", { outputLength: 4 })
          .update(content)
          .digest("hex");

        let symbolId = symbolIdPattern;
        if (symbolIdPattern.includes("[name]")) {
          symbolId = symbolId.replace("[name]", basename);
        }
        if (symbolId.includes("[hash]")) {
          symbolId = symbolId.replace("[hash]", hash);
        }

        // only add the icon if it hasn't been added before
        if (!icons.has(symbolId)) {
          store.add(symbolId, content);
          icons.add(id);
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
      console.log(icons.size, "icons added to sprite");

      let spritePath = path.join(outDir, assetsDir, spriteOutputName);
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
  };
}
