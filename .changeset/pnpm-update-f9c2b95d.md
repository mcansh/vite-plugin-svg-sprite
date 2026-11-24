---
"@mcansh/vite-plugin-svg-sprite": patch
---

Fix the CommonJS entry point by using Node's built-in SHA-512 hashing for SVG symbol IDs. Update `fs-extra` to 11.4 and remove the unused Chokidar dependency.
