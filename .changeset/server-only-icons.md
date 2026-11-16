---
"@mcansh/vite-plugin-svg-sprite": patch
---

fix: include icons that are only imported on the server in the client sprite

Previously the client and server builds each emitted their own sprite. Icons only imported by server code (e.g. in a `loader`) were missing from the client sprite, and server rendered HTML referenced the server build's sprite, which isn't served to the browser. The server build now merges in the client build's icons and its sprite replaces the client one, so both builds reference the same sprite.
