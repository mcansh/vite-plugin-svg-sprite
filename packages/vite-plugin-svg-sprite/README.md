# @mcansh/vite-plugin-svg-sprite

Vite plugin that combines imported SVGs into a single optimized sprite sheet, with each import resolving to a `<use href>`-ready symbol URL.

## Why use a sprite

The browser downloads one sprite file and can cache it. Each icon in the page is a symbol URL. The page does not repeat the SVG markup inline.

## Install

```sh
npm i -D @mcansh/vite-plugin-svg-sprite
```

## Set up Vite

Add `svgSprite` to the Vite `plugins` array.

```ts
import { svgSprite } from "@mcansh/vite-plugin-svg-sprite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [svgSprite()],
})
```

## Set up React Router

Use `reactRouter` from `@react-router/dev/vite`.

```ts
import { svgSprite } from "@mcansh/vite-plugin-svg-sprite"
import { reactRouter } from "@react-router/dev/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [reactRouter(), svgSprite()],
})
```

## Set the options

`svgSprite` accepts these options.

| Option             | Default                | Effect                                                              |
| ------------------ | ---------------------- | ------------------------------------------------------------------- |
| `spriteOutputName` | `"sprite.svg"`         | Asset name of the sprite file.                                      |
| `symbolId`         | `"icon-[name]-[hash]"` | Id pattern for each symbol.                                         |
| `svgstoreOptions`  | `{}`                   | Options passed to svgstore. Your keys override the plugin defaults. |
| `logging`          | `false`                | Deprecated. Use Vite's `logLevel` instead.                          |

`spriteOutputName` is the file name Vite gives the sprite asset. During `vite dev`, the plugin serves the sprite at `/${assetsDir}/${spriteOutputName}`. The default `assetsDir` is `assets`. A production build can add Vite's asset hash to that file name.

`symbolId` accepts `[name]` and `[hash]`. `[name]` is the SVG file name without `.svg`. `[hash]` is the SHA-512 hex digest of the module id. The plugin replaces the first `[name]` and the first `[hash]`.

`svgstoreOptions` is applied on top of `{ renameDefs: true, copyAttrs: DEFAULT_COPY_ATTRS }`. `DEFAULT_COPY_ATTRS` lists `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`, and `stroke-dashoffset`. If you set `copyAttrs`, your array replaces that list. Spread `DEFAULT_COPY_ATTRS` when you still want those attributes. svgstore always copies `viewBox`, `aria-labelledby`, and `role`. The published package ships those svgstore types, so fields such as `copyAttrs` are typed.

```ts
import { DEFAULT_COPY_ATTRS, svgSprite } from "@mcansh/vite-plugin-svg-sprite"

svgSprite({
  spriteOutputName: "sprite.svg",
  symbolId: "icon-[name]-[hash]",
  svgstoreOptions: {
    copyAttrs: [...DEFAULT_COPY_ATTRS, "class"],
  },
})
```

When `logging` is `true`, the plugin warns that the option is deprecated.

## Use an icon

Import an SVG. The default export is the sprite URL plus the symbol id. Pass that string to `<use href>`.

```tsx
import iconHref from "./icon.svg"

export function Icon() {
  return (
    <svg className="size-4" aria-hidden>
      <use href={iconHref} />
    </svg>
  )
}
```

## Preload the sprite

`virtual:@mcansh/vite-plugin-svg-sprite` exports the sprite URL with no symbol id.

```tsx
import spriteUrl from "virtual:@mcansh/vite-plugin-svg-sprite"

import type { Route } from "./+types/root"

export const links: Route.LinksFunction = () => [
  { rel: "preload", as: "image", href: spriteUrl, type: "image/svg+xml" },
]
```

## Add the client types

`client.d.ts` declares that virtual module. The package exports it from `@mcansh/vite-plugin-svg-sprite/client`. Add that name to `compilerOptions.types`.

```json
{
  "compilerOptions": {
    "types": ["vite/client", "@mcansh/vite-plugin-svg-sprite/client"]
  }
}
```

## Supported Vite versions

The peer dependency accepts Vite 5, Vite 6, Vite 7, or Vite 8, including prereleases of those majors. The declared range is `^5.0.0-0 || ^6.0.0-0 || ^7.0.0-0 || ^8.0.0-0`.

## Server rendering

React Router and Remix build the client before the server. The client build writes `<cacheDir>/@mcansh/vite-plugin-svg-sprite/client-build.json`. The default `cacheDir` is `node_modules/.vite`.

The record stores the project root, the client output directory, the emitted sprite file name, and the symbol ids. The server build reads that record.

- An icon that is already in the client sprite keeps the client sprite URL. Server HTML and the client bundle then point at the same file.
- An icon imported only by server code goes into a second sprite. The server build copies that sprite into the client output directory.
- The server build does not change client files or the client sprite.

The plugin uses the record only when the JSON has the expected fields, the root matches this project, and the recorded sprite is still a file. A new client build deletes the previous record at the start of the build, then writes a new record. The plugin ignores an unreadable or invalid record and logs a warning.
