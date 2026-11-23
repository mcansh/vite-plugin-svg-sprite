import { svgSprite } from "@mcansh/vite-plugin-svg-sprite"
import { remix } from "pitlane/vite-plugin-remix"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    remix({
      clientEntry: "app/actions/public/entry.ts",
      serverEntry: "app/entry.server.tsx",
    }),
    svgSprite(),
  ],
  server: { port: 4477, strictPort: true },
  preview: { port: 4477, strictPort: true },
})
