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

/**
 * Written by a client build so that server builds of the same project can
 * point at the client sprite and only add the icons it doesn't have.
 */
type ClientBuildRecord = {
  root: string;
  outDir: string;
  spriteFileName: string;
  symbolIds: Array<string>;
};

type BuildState = {
  isServer: boolean;
  /** the sprite this build emitted, if any */
  spriteFileName: string | undefined;
  symbolIds: Array<string>;
  clientBuild: ClientBuildRecord | null;
  rewrite: (content: string) => string;
  /** output file name -> content with the sprite url replaced */
  rewrites: Map<string, string>;
};

type EnvironmentLike =
  | {
      name: string;
      config: { consumer?: string; build: { outDir: string } };
    }
  | undefined;

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

  let svgstoreOptions: SVGStoreOptions = {
    renameDefs: true,
    copyAttrs: DEFAULT_COPY_ATTRS,
    ...options.svgstoreOptions,
  };

  // every icon seen so far, used by the dev server
  let icons = new Map<string, string>();
  // icons imported by each environment's build, keyed by environment name
  let environmentIcons = new Map<string, Map<string, string>>();
  // state handed from generateBundle to writeBundle, keyed by outDir
  let builds = new Map<string, BuildState>();

  function getSpriteUrlPlaceholder() {
    return `/${config.build.assetsDir}/${options.spriteOutputName}`;
  }

  function getBuildTarget(environment: EnvironmentLike) {
    return {
      name: environment?.name ?? (config.build.ssr ? "ssr" : "client"),
      isServer: environment
        ? environment.config.consumer === "server"
        : Boolean(config.build.ssr),
      outDir: path.resolve(
        config.root,
        (environment?.config ?? config).build.outDir,
      ),
    };
  }

  function getEnvironmentIcons(name: string) {
    let result = environmentIcons.get(name);
    if (!result) {
      result = new Map();
      environmentIcons.set(name, result);
    }
    return result;
  }

  function getClientBuildRecordPath() {
    return path.join(config.cacheDir, PLUGIN_NAME, "client-build.json");
  }

  function warnUnreadableRecord(reason: unknown) {
    config.logger.warn(
      `[${PLUGIN_NAME}] ignoring unreadable ${getClientBuildRecordPath()}: ${String(reason)}`,
    );
  }

  function isClientBuildRecord(value: unknown): value is ClientBuildRecord {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    let record = value as Record<string, unknown>;
    return (
      typeof record.root === "string" &&
      typeof record.outDir === "string" &&
      typeof record.spriteFileName === "string" &&
      Array.isArray(record.symbolIds) &&
      record.symbolIds.every((id) => typeof id === "string")
    );
  }

  async function readClientBuildRecord(): Promise<ClientBuildRecord | null> {
    let parsed: unknown;
    try {
      parsed = await fse.readJson(getClientBuildRecordPath());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        warnUnreadableRecord(error);
      }
      return null;
    }

    if (!isClientBuildRecord(parsed)) {
      warnUnreadableRecord("invalid client build record");
      return null;
    }

    if (parsed.root !== config.root) return null;
    let clientSprite = path.join(parsed.outDir, parsed.spriteFileName);
    if (!(await fse.pathExists(clientSprite))) return null;
    return parsed;
  }

  async function addIconToSprite(id: string) {
    let content = await fse.readFile(id, "utf-8");

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

    return { symbolId, content };
  }

  function renderSprite(entries: Iterable<[string, string]>) {
    let store = svgstore(svgstoreOptions);
    let sorted = Array.from(entries).sort((a, b) => a[0].localeCompare(b[0]));

    for (let [id, content] of sorted) {
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

    return optimized.data;
  }

  /**
   * Replaces the sprite url placeholder (with or without a `#symbolId`) with
   * the file name returned by `resolveFileName`.
   */
  function createSpriteUrlRewriter(
    resolveFileName: (symbolId: string | undefined) => string,
  ) {
    let regex = new RegExp(
      escapeRegExp(getSpriteUrlPlaceholder()) + "(?:#([^\"'`\\s\\\\)]+))?",
      "g",
    );

    return (content: string) => {
      return content.replace(regex, (_match, symbolId?: string) => {
        let url = `/${resolveFileName(symbolId)}`;
        return symbolId ? `${url}#${symbolId}` : url;
      });
    };
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
          let spriteUrl = getSpriteUrlPlaceholder();
          return js`export default ${JSON.stringify(spriteUrl)}`;
        }
      },

      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },

      async buildStart() {
        if (config.command !== "build") return;
        let target = getBuildTarget(this.environment);
        environmentIcons.set(target.name, new Map());
        if (!target.isServer) {
          await fse.remove(getClientBuildRecordPath());
        }
      },

      async transform(_code, id) {
        if (svgRegex.test(id)) {
          let spriteUrl = getSpriteUrlPlaceholder();
          let { symbolId, content } = await addIconToSprite(id);
          let { name } = getBuildTarget(this.environment);
          getEnvironmentIcons(name).set(symbolId, content);

          return {
            code: js`export default "${spriteUrl}#${symbolId}";`,
            map: { mappings: "" },
          };
        }
      },

      async generateBundle(_, bundle) {
        let { name, isServer, outDir } = getBuildTarget(this.environment);
        let buildIcons = getEnvironmentIcons(name);

        // The client is built before the server, so its sprite can't contain
        // icons that are only imported by server code (e.g. in a loader). A
        // server build points at the client sprite for the icons it has and
        // emits a second sprite with the rest, which is copied into the
        // client build in writeBundle.
        let clientBuild = isServer ? await readClientBuildRecord() : null;
        let clientSymbolIds = new Set(clientBuild?.symbolIds);
        let spriteIcons = Array.from(buildIcons).filter(([symbolId]) => {
          return !clientSymbolIds.has(symbolId);
        });

        let spriteFileName: string | undefined;
        if (!clientBuild || spriteIcons.length > 0) {
          let referenceId = this.emitFile({
            type: "asset",
            source: renderSprite(spriteIcons),
            name: options.spriteOutputName,
          });
          spriteFileName = this.getFileName(referenceId);
        }

        let rewrite = createSpriteUrlRewriter((symbolId) => {
          if (
            clientBuild &&
            (!spriteFileName ||
              symbolId === undefined ||
              clientSymbolIds.has(symbolId))
          ) {
            return clientBuild.spriteFileName;
          }
          return spriteFileName as string;
        });

        let rewrites = new Map<string, string>();
        for (let chunk of Object.values(bundle)) {
          if (chunk.type !== "chunk") continue;
          let content = rewrite(chunk.code);
          if (content === chunk.code) continue;
          rewrites.set(chunk.fileName, content);
          this.debug(`found sprite url in ${chunk.fileName}`);
        }

        builds.set(outDir, {
          isServer,
          spriteFileName,
          symbolIds: Array.from(buildIcons.keys()),
          clientBuild,
          rewrite,
          rewrites,
        });
      },

      async writeBundle() {
        let { isServer, outDir } = getBuildTarget(this.environment);
        let build = builds.get(outDir);
        if (!build) {
          this.warn(`no sprite found for ${outDir}, skipping`);
          return;
        }
        builds.delete(outDir);

        // compare what was written with what generateBundle saw before
        // replacing the sprite url, so changes made by other plugins in
        // between aren't overwritten
        for (let [fileName, content] of build.rewrites) {
          let filePath = path.join(outDir, fileName);
          let written = await fse.readFile(filePath, "utf-8");

          if (build.rewrite(written) !== content) {
            this.error(
              `${filePath} changed after the sprite url was found, not replacing it`,
            );
          }

          await fse.outputFile(filePath, content);
          this.debug(`replaced sprite url in ${filePath}`);
        }

        if (!isServer) {
          if (!build.spriteFileName) return;
          let record: ClientBuildRecord = {
            root: config.root,
            outDir,
            spriteFileName: build.spriteFileName,
            symbolIds: build.symbolIds,
          };
          await fse.outputJson(getClientBuildRecordPath(), record);
          return;
        }

        // The server-only sprite has to be served by the client build. Its
        // name is content hashed, so if another server build (e.g. a parallel
        // server bundle) already copied it, it has the same content. Client
        // files and the client sprite are never changed.
        if (build.clientBuild && build.spriteFileName) {
          let target = path.join(
            build.clientBuild.outDir,
            build.spriteFileName,
          );
          if (!(await fse.pathExists(target))) {
            let temp = `${target}.${process.pid}-${Date.now()}.tmp`;
            await fse.copy(path.join(outDir, build.spriteFileName), temp);
            await fse.move(temp, target, { overwrite: true });
            this.debug(`copied ${build.spriteFileName} to the client build`);
          }
        }
      },
    },
    {
      name: `${PLUGIN_NAME}:dev-server`,
      sharedDuringBuild: true,
      apply(config, env) {
        return env.command === "serve";
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === getSpriteUrlPlaceholder()) {
            res.setHeader("Content-Type", "image/svg+xml");
            return res.end(renderSprite(icons));
          }

          return next();
        });
      },
    },
  ];
}
