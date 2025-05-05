import { svgSprite } from "@mcansh/vite-plugin-svg-sprite";
import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

installGlobals();

export default defineConfig({
  plugins: [
    remix(),
    tsconfigPaths(),
    svgSprite({
      logging: true,
      spriteOutputName: "mysvgsprite.svg",
    }),
  ],
});
