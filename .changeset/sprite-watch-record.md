---
"@mcansh/vite-plugin-svg-sprite": patch
---

fix: drop icons that are no longer imported from the sprite in `vite build --watch`, and ignore a client build record that isn't a valid object instead of failing the build
