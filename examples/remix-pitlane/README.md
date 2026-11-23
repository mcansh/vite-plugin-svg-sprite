# Remix 3 + Pitlane

A Node example of `@mcansh/vite-plugin-svg-sprite` with Remix 3, Vite 8, and [Pitlane](https://github.com/pitlane-tools/pitlane).

The app skeleton comes from the Pitlane Railway Node template:

https://github.com/pitlane-tools/templates/tree/0642843727610a3494ac4e1a448670402f837779/railway-node

The route layout follows [mcan.sh](https://github.com/mcansh/mcan.sh): `app/routes.ts`, `app/router.tsx`, `app/entry.server.tsx`, route actions, middleware, `app/assets.ts`, and `app/actions/public/entry.ts`. Cloudflare-only pieces are left out. Pitlane stays on `1.0.0-alpha.2`, the same version mcan.sh pins, and Remix is `3.2.0`.

## What it shows

`vite.config.ts` registers Pitlane's Remix plugin and this sprite plugin:

```ts
plugins: [
  remix({
    clientEntry: "app/actions/public/entry.ts",
    serverEntry: "app/entry.server.tsx",
  }),
  svgSprite(),
]
```

`serverHandler` stays on, so `vite dev` and `vite preview` serve the Node fetch handler. The home page imports `star.svg` in a server component and `plus.svg` in a `clientEntry` button. Both render `<use href="…">`. Icons shared with the client keep the client sprite URL. A server-only icon is copied into the client output so the browser can still fetch it.

## Scripts

```sh
pnpm dev
pnpm build
pnpm preview
pnpm start
pnpm test
pnpm typecheck
```

`start` runs `node --import remix/node-tsx ./server.ts`. That process listens with `remix/node-fetch-server` on `PORT` (default `4477`) and loads the handler `pnpm build` emitted. Tests use `node --import remix/node-tsx --test`. A small hook stands in for Vite's SVG import while those tests render the page.
