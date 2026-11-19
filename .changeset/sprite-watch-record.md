---
"@mcansh/vite-plugin-svg-sprite": patch
---

Remove icons from the sprite in `vite build --watch` when their imports are removed.

SSR builds now warn and emit a standalone sprite when the cached client build record contains invalid JSON or fields, or when the cached sprite path points to a directory.
