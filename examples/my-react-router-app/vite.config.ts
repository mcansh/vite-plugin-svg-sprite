import { svgSprite } from "@mcansh/vite-plugin-svg-sprite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  build: {
    outDir: "build",
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    svgSprite({
    	logging: true,
     	unstable_environment_api: {
      	ssr: "server",
       client: "client",
      }
    }),
  ],
});
