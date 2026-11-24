import { svgSprite } from "@mcansh/vite-plugin-svg-sprite"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import inspect from "vite-plugin-inspect"

export default defineConfig({
  build: {
    outDir: "build",
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), reactRouter(), svgSprite({ logging: true }), inspect()],
})
