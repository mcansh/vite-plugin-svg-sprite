import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { createSvgSpritePlugin } from "@mcansh/vite-plugin-svg-sprite";

installGlobals();

export default defineConfig({
  plugins: [
    remix(),
    tsconfigPaths(),
    createSvgSpritePlugin({
      logging: true,
      spriteOutputName: "mysvgsprite.svg",
    }),
  ],
});
