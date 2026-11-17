# @mcansh/vite-plugin-svg-sprite

this vite plugin will transform any imported svg files and combine them into an svg sprite sheet

## installation and set up

```sh
npm i -D @mcansh/vite-svg-sprite-plugin
```

this is an example using Remix, but this plugin works with any vite configuration

```ts
import { svgSprite } from "@mcansh/vite-plugin-svg-sprite";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths(), svgSprite()],
});
```

you can configure the generated sprite file name as well as the generated symbol id pattern

```ts
import { DEFAULT_COPY_ATTRS, svgSprite } from "@mcansh/vite-plugin-svg-sprite";

svgSprite({
  spriteOutputName: "sprite.svg",
  symbolId: "icon-[name]-[hash]",
  svgstoreOptions: {
    copyAttrs: [
      ...DEFAULT_COPY_ATTRS,
      // any additional attributes you want to copy from the svg to the symbol
    ],
  },
});
```

## usage

```tsx
import spriteUrl from "virtual:@mcansh/vite-plugin-svg-sprite";
import linkIconHref from "@primer/octicons/build/svg/link-16.svg";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => {
  return [
    { rel: "preload", as: "image", href: spriteUrl, type: "image/svg+xml" },
  ];
};

export default function Component() {
  return (
    <svg className="size-4" aria-hidden>
      <use href={linkIconHref} />
    </svg>
  );
}
```

## server rendering (react router, remix, ssr builds)

when the client is built before the server (as react router and remix do), the client build writes a small record of its sprite to `<cacheDir>/@mcansh/vite-plugin-svg-sprite/client-build.json` (`node_modules/.vite` by default).

the server build reads that record and:

- points icons that are already in the client sprite at the client sprite, so server rendered html and the client bundle reference the same file
- puts icons that are only imported by server code (e.g. returned from a `loader`) into a separate sprite and copies it into the client `outDir` so the browser can load it

the server build never changes client files or the client sprite. the record is only used when it comes from a client build of the same project root whose sprite still exists, and a new client build replaces it.
