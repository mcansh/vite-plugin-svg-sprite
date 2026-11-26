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
  server: { port: 44100 },
  preview: { port: 44100 },
})
