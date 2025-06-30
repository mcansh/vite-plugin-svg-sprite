import type { Config } from "@mcansh/vite-plugin-svg-sprite";
import { createSvgSpritePlugin as svgSprite } from "@mcansh/vite-plugin-svg-sprite";
import type { Plugin } from "vite";
import pkgJson from "../package.json";

/**
 * @deprecated - this package has been renamed to `@mcansh/vite-plugin-svg-sprite`
 */
export function createSvgSpritePlugin(configOptions: Config): Array<Plugin> {
  return [
    {
      name: pkgJson.name,
      buildStart() {
        this.warn(
          "this package has been renamed to `@mcansh/vite-plugin-svg-sprite`",
        );
      },
    },
    ...svgSprite(configOptions),
  ];
}
