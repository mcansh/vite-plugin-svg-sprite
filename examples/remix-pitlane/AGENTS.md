# Remix Pitlane example

This example is a Node app. It follows the mcan.sh route layout and the Pitlane Railway Node template. It does not use Cloudflare.

## Commands

```sh
pnpm dev
pnpm build
pnpm preview
pnpm start
pnpm test
pnpm typecheck
pnpm format
pnpm lint
```

`dev`, `build`, and `preview` go through Vite and Pitlane. `start` serves the built fetch handler with Node.

## Layout

- `app/routes.ts` is the route contract.
- `app/actions/controller.tsx` owns the route actions.
- `app/router.tsx` wires middleware and maps routes to that controller.
- `app/entry.server.tsx` is the fetch handler Vite and `server.ts` load.
- `app/assets.ts` resolves the browser entry and stylesheet.
- `app/actions/public/entry.ts` hydrates client components.
- `app/actions/public/css-mixins.ts` holds shared `css()` mixins.
- `app/middleware/` holds request middleware.

Sprite icons are SVG files imported as their sprite URL. The server page and the client button both render `<use href>`.
