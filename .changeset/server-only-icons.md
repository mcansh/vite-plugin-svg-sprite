---
"@mcansh/vite-plugin-svg-sprite": patch
---

fix: serve icons that are only imported on the server

Previously the client and server builds each emitted their own sprite. Icons only imported by server code (e.g. returned from a `loader`) were missing from the client sprite, and server rendered HTML referenced the server build's sprite, which isn't served to the browser. Server builds now point at the client sprite for the icons it has and copy a sprite with the remaining icons into the client build. Server bundles built in parallel no longer leave the sprite url placeholder in their output.
