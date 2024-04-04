---
"@mcansh/vite-svg-sprite-plugin": patch
"vite-no-remix": patch
---

- add svgo to minify sprite, re-add hashing to sprite.svg file name
- adds a virtual moduel `virtual:vite-svg-sprite-plugin` that returns the sprite url for preloading, etc
- adds client.d.ts file for virtual module
