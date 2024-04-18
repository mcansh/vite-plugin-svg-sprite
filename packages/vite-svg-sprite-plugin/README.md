# @mcansh/vite-plugin-svg-sprite

this vite plugin will transform any imported svg files and combine them into an svg sprite sheet

## installation and set up

```sh
  npm i -D @mcansh/vite-plugin-svg-sprite
```

this is an example using Remix, but this plugin should work everywhere else as well

```ts
import { svgSpritePlugin } from "@mcansh/vite-plugin-svg-sprite";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths(), svgSpritePlugin()],
});
```

you can configure the generated sprite file name as well as the generated symbol id pattern

```ts
// these are the default options
svgSpritePlugin({
  spriteOutputName: "sprite.svg",
  symbolId: "icon-[name]-[hash]",
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
