import { createSvgSpritePlugin } from "@mcansh/vite-plugin-svg-sprite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import inspect from "vite-plugin-inspect";

export default defineConfig({
  build: { assetsDir: "something-other-than-assets" },
  plugins: [react(), createSvgSpritePlugin({ logging: true }), inspect()],
});
