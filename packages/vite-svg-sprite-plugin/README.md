# @mcansh/vite-svg-sprite-plugin

this vite plugin will transform any imported svg files and combine them into an svg sprite sheet

## installation and set up

```sh
  npm i -D @mcansh/vite-svg-sprite-plugin
```

this is an example using Remix, but this plugin should work every where else as well

```ts
import { createSpriteFromImportedSvgs } from "@mcansh/vite-svg-sprite-plugin";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths(), createSpriteFromImportedSvgs()],
});
```

you can configure the generated sprite file name as well as the generated symbol id pattern

```ts
// these are the default options
createSpriteFromImportedSvgs({
    spriteOutputName: 'sprite.svg',
    symbolId: 'icon-[name]-[hash]',
})
```


## usage

```tsx
  import linkIconHref from "@primer/octicons/build/svg/link-16.svg";

  <svg className="size-4" aria-hidden>
    <use href={linkIconHref} />
  </svg>
```
