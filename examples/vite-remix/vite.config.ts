import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { createSvgSpritePlugin } from "@mcansh/vite-svg-sprite-plugin";

installGlobals();

export default defineConfig({
  plugins: [
    remix(),
    tsconfigPaths(),
    createSvgSpritePlugin({
      spriteOutputName: "sprite.svg",
    }),
  ],
});
