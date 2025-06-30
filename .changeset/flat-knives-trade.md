---
"@mcansh/vite-plugin-svg-sprite": patch
---

chore: refactor deprecation warnings to use Vite logger API

create a custom logger and set logLevel to “info” when logging: true is set for the plugin
