import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { svgSprite } from "@mcansh/vite-plugin-svg-sprite";

export default defineConfig({
  build: { assetsDir: "something-other-than-assets" },
  plugins: [react(), svgSprite()],
});
