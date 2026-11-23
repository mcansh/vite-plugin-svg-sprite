import { randomUUID } from "node:crypto"
import path from "node:path"

import fse from "fs-extra"
import { hash } from "hasha"
import * as svgo from "svgo"
import type { Options as SVGStoreOptions } from "svgstore"
import svgstore from "svgstore"
import type { Plugin, ResolvedConfig } from "vite"
import { createLogger } from "vite"

const svgRegex = /\.svg$/
const PLUGIN_NAME = "@mcansh/vite-plugin-svg-sprite"

const virtualModuleId = `virtual:${PLUGIN_NAME}`
const resolvedVirtualModuleId = "\0" + virtualModuleId

const js = String.raw

export type Config = Partial<{
  spriteOutputName: string
  symbolId: string
  /**
   * @deprecated - use Vite's built in --logLevel instead
   * @see https://vite.dev/config/shared-options.html#loglevel
   */
  logging: boolean
  svgstoreOptions: SVGStoreOptions
}>

/**
 * Written by a client build so that server builds of the same project can
 * point at the client sprite and only add the icons it doesn't have.
 */
type ClientBuildRecord = {
  root: string
  outDir: string
  spriteFileName: string
  symbolIds: Array<string>
}

type SpriteIcon = {
  symbolId: string
  content: string
}

type BuildState = {
  isServer: boolean
  /** the sprite this build emitted, if any */
  spriteFileName: string | undefined
  symbolIds: Array<string>
  clientBuild: ClientBuildRecord | null
  rewrite: (content: string) => string
  /** output file name -> content with the sprite url replaced */
  rewrites: Map<string, string>
}

type EnvironmentLike =
  | {
      name: string
      config: { consumer?: string; build: { outDir: string } }
    }
  | undefined

export function createSvgSpritePlugin(configOptions?: Config): Array<Plugin> {
  let logger = createLogger(configOptions?.logging ? "info" : undefined)
  return [
    {
      name: `${PLUGIN_NAME}:deprecation`,
      buildStart() {
        logger.warnOnce(
          `createSvgSpritePlugin has been renamed to svgSprite, please update your imports as this will be removed in a future release.`,
        )
      },
    },
    ...svgSprite(configOptions),
  ]
}

export const DEFAULT_COPY_ATTRS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
]

/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- Validate the JSON cache record before using it. */
function isClientBuildRecord(value: unknown): value is ClientBuildRecord {
  if (typeof value !== "object" || value === null) return false
  return (
    "root" in value &&
    typeof value.root === "string" &&
    "outDir" in value &&
    typeof value.outDir === "string" &&
    "spriteFileName" in value &&
    typeof value.spriteFileName === "string" &&
    "symbolIds" in value &&
    Array.isArray(value.symbolIds) &&
    value.symbolIds.every((symbolId) => typeof symbolId === "string")
  )
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */

// what an id that isn't known can contain. A known id only matches where an unknown one would
// end, so it can't claim the start of a longer id that is completed at runtime.
const unknownIdCharacter = /[^"'`\s\\)]/

/**
 * Reads the symbol id of the `#symbolId` at `index`. Ids come from file names, so they can contain
 * any character: look for the known ids first, longest first, and only guess where an unknown id
 * ends.
 */
function readSymbolId(
  content: string,
  index: number,
  knownIds: Set<string>,
  knownIdLengths: Array<number>,
) {
  if (content[index] !== "#") return undefined

  let start = index + 1
  for (let length of knownIdLengths) {
    let symbolId = content.slice(start, start + length)
    if (knownIds.has(symbolId) && !unknownIdCharacter.test(content.charAt(start + length))) {
      return symbolId
    }
  }

  let unknownId = new RegExp(`${unknownIdCharacter.source}+`, "y")
  unknownId.lastIndex = start
  return unknownId.exec(content)?.[0]
}

export function svgSprite(configOptions?: Config): Array<Plugin> {
  let config: ResolvedConfig
  let options: Required<Config> = {
    spriteOutputName: "sprite.svg",
    symbolId: "icon-[name]-[hash]",
    logging: false,
    svgstoreOptions: {},
    ...configOptions,
  }

  let logger = createLogger(options.logging ? "info" : undefined)

  if (options.logging) {
    logger.warnOnce(
      `[${PLUGIN_NAME}]: the \`logging\` has been deprecated and will be removed in a future release. Please use Vite's built-in logLevel instead.`,
    )
  }

  let svgstoreOptions: SVGStoreOptions = {
    renameDefs: true,
    copyAttrs: DEFAULT_COPY_ATTRS,
    ...options.svgstoreOptions,
  }

  // every icon seen so far, used by the dev server
  let icons = new Map<string, string>()
  // state handed from generateBundle to writeBundle, keyed by outDir
  let builds = new Map<string, BuildState>()

  function getSpriteUrlPlaceholder() {
    return `/${config.build.assetsDir}/${options.spriteOutputName}`
  }

  function getBuildTarget(environment: EnvironmentLike) {
    return {
      isServer: environment ? environment.config.consumer === "server" : Boolean(config.build.ssr),
      outDir: path.resolve(config.root, (environment?.config ?? config).build.outDir),
    }
  }

  function getClientBuildRecordPath() {
    return path.join(config.cacheDir, PLUGIN_NAME, "client-build.json")
  }

  async function readClientBuildRecord(): Promise<ClientBuildRecord | null> {
    let recordPath = getClientBuildRecordPath()
    let record: unknown
    try {
      record = await fse.readJson(recordPath)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        config.logger.warn(`[${PLUGIN_NAME}] ignoring unreadable ${recordPath}: ${String(error)}`)
      }
      return null
    }

    if (!isClientBuildRecord(record)) {
      config.logger.warn(`[${PLUGIN_NAME}] ignoring invalid ${recordPath}`)
      return null
    }

    // only use a record from a client build of this project whose output is
    // still there
    if (record.root !== config.root) return null
    let clientSprite = path.join(record.outDir, record.spriteFileName)
    let spriteStat = await fse.stat(clientSprite).catch(() => null)
    if (!spriteStat) return null
    if (!spriteStat.isFile()) {
      config.logger.warn(
        `[${PLUGIN_NAME}] ignoring invalid ${recordPath}: expected a regular file at ${clientSprite}`,
      )
      return null
    }
    return record
  }

  async function addIconToSprite(id: string): Promise<SpriteIcon> {
    let content = await fse.readFile(id, "utf-8")

    let basename = path.basename(id, ".svg")
    let symbolId = options.symbolId
    if (options.symbolId.includes("[name]")) {
      symbolId = symbolId.replace("[name]", basename)
    }
    if (options.symbolId.includes("[hash]")) {
      let contentHash = await hash(id)
      symbolId = symbolId.replace("[hash]", contentHash)
    }

    icons.set(symbolId, content)

    return { symbolId, content }
  }

  function renderSprite(entries: Iterable<[string, string]>) {
    let store = svgstore(svgstoreOptions)
    let sorted = Array.from(entries).sort((a, b) => a[0].localeCompare(b[0]))

    for (let [id, content] of sorted) {
      store.add(id, content)
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
    })

    return optimized.data
  }

  /**
   * Replaces the sprite url placeholder (with or without a `#symbolId`) with
   * the file name returned by `resolveFileName`.
   */
  function createSpriteUrlRewriter(
    knownIds: Set<string>,
    resolveFileName: (symbolId: string | undefined) => string,
  ) {
    let placeholder = getSpriteUrlPlaceholder()
    let knownIdLengths = Array.from(new Set(Array.from(knownIds, (id) => id.length))).sort(
      (a, b) => b - a,
    )

    // only the url is replaced, whatever follows it is left as written
    return (content: string) =>
      content.replaceAll(placeholder, (url: string, index: number) => {
        let symbolId = readSymbolId(content, index + url.length, knownIds, knownIdLengths)
        return `/${resolveFileName(symbolId)}`
      })
  }

  return [
    {
      name: PLUGIN_NAME,
      sharedDuringBuild: true,

      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId
        }
      },

      async load(id) {
        if (id === resolvedVirtualModuleId) {
          let spriteUrl = getSpriteUrlPlaceholder()
          return js`export default ${JSON.stringify(spriteUrl)}`
        }
      },

      configResolved(resolvedConfig) {
        config = resolvedConfig
      },

      async buildStart() {
        if (config.command !== "build") return
        // a new client build replaces whatever an earlier one recorded
        if (!getBuildTarget(this.environment).isServer) {
          await fse.remove(getClientBuildRecordPath())
        }
      },

      async transform(_code, id) {
        if (svgRegex.test(id)) {
          let spriteUrl = getSpriteUrlPlaceholder()
          let icon = await addIconToSprite(id)

          return {
            code: js`export default "${spriteUrl}#${icon.symbolId}";`,
            map: { mappings: "" },
            meta: { [PLUGIN_NAME]: icon },
          }
        }
      },

      async generateBundle(_, bundle) {
        let { isServer, outDir } = getBuildTarget(this.environment)

        let buildIcons = new Map<string, string>()
        // The current module graph includes imports used only to register
        // icons, even when tree shaking removes them from the output chunks.
        for (let moduleId of this.getModuleIds()) {
          if (!svgRegex.test(moduleId)) continue
          let icon: SpriteIcon | undefined = this.getModuleInfo(moduleId)?.meta[PLUGIN_NAME]
          if (icon) buildIcons.set(icon.symbolId, icon.content)
        }

        // The client is built before the server, so its sprite can't contain
        // icons that are only imported by server code (e.g. in a loader). A
        // server build points at the client sprite for the icons it has and
        // emits a second sprite with the rest, which is copied into the
        // client build in writeBundle.
        let clientBuild = isServer ? await readClientBuildRecord() : null
        let clientSymbolIds = new Set(clientBuild?.symbolIds)
        let spriteIcons = Array.from(buildIcons).filter(
          ([symbolId]) => !clientSymbolIds.has(symbolId),
        )

        let spriteFileName: string | undefined
        if (!clientBuild || spriteIcons.length > 0) {
          let referenceId = this.emitFile({
            type: "asset",
            source: renderSprite(spriteIcons),
            name: options.spriteOutputName,
          })
          spriteFileName = this.getFileName(referenceId)
        }

        let knownIds = new Set([...buildIcons.keys(), ...clientSymbolIds])
        let rewrite = createSpriteUrlRewriter(knownIds, (symbolId) => {
          if (
            clientBuild &&
            (!spriteFileName || symbolId === undefined || clientSymbolIds.has(symbolId))
          ) {
            return clientBuild.spriteFileName
          }
          // SAFETY: A missing spriteFileName always uses the client sprite above.
          return spriteFileName as string
        })

        let rewrites = new Map<string, string>()
        for (let chunk of Object.values(bundle)) {
          if (chunk.type !== "chunk") continue
          let content = rewrite(chunk.code)
          if (content === chunk.code) continue
          rewrites.set(chunk.fileName, content)
          this.debug(`found sprite url in ${chunk.fileName}`)
        }

        builds.set(outDir, {
          isServer,
          spriteFileName,
          symbolIds: Array.from(buildIcons.keys()),
          clientBuild,
          rewrite,
          rewrites,
        })
      },

      async writeBundle() {
        let { isServer, outDir } = getBuildTarget(this.environment)
        let build = builds.get(outDir)
        if (!build) {
          this.warn(`no sprite found for ${outDir}, skipping`)
          return
        }
        builds.delete(outDir)

        // compare what was written with what generateBundle saw before
        // replacing the sprite url, so changes made by other plugins in
        // between aren't overwritten
        for (let [fileName, content] of build.rewrites) {
          let filePath = path.join(outDir, fileName)
          let written = await fse.readFile(filePath, "utf-8")

          if (build.rewrite(written) !== content) {
            this.error(`${filePath} changed after the sprite url was found, not replacing it`)
          }

          await fse.outputFile(filePath, content)
          this.debug(`replaced sprite url in ${filePath}`)
        }

        if (!isServer) {
          if (!build.spriteFileName) return
          let record: ClientBuildRecord = {
            root: config.root,
            outDir,
            spriteFileName: build.spriteFileName,
            symbolIds: build.symbolIds,
          }
          await fse.outputJson(getClientBuildRecordPath(), record)
          return
        }

        // The server-only sprite has to be served by the client build. Its
        // name is content hashed, so if another server build (e.g. a parallel
        // server bundle) already copied it, it has the same content. Client
        // files and the client sprite are never changed.
        if (build.clientBuild && build.spriteFileName) {
          let target = path.join(build.clientBuild.outDir, build.spriteFileName)
          if (!(await fse.pathExists(target))) {
            let temp = `${target}.${randomUUID()}.tmp`
            try {
              await fse.copy(path.join(outDir, build.spriteFileName), temp)
              // not fse.move, which deletes the target before replacing it
              await fse.rename(temp, target)
              this.debug(`copied ${build.spriteFileName} to the client build`)
            } catch (error) {
              // Windows can refuse to replace a file another build just put
              // there, which is fine because it has the same content
              if (!(await fse.pathExists(target))) throw error
            } finally {
              await fse.remove(temp)
            }
          }
        }
      },
    },
    {
      name: `${PLUGIN_NAME}:dev-server`,
      sharedDuringBuild: true,
      apply(config, env) {
        return env.command === "serve"
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === getSpriteUrlPlaceholder()) {
            res.setHeader("Content-Type", "image/svg+xml")
            return res.end(renderSprite(icons))
          }

          return next()
        })
      },
    },
  ]
}
