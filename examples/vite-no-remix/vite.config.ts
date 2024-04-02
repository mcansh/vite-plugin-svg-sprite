import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { createSvgSpritePlugin } from "@mcansh/vite-svg-sprite-plugin";

export default defineConfig({
  plugins: [react(), createSvgSpritePlugin()],
});
