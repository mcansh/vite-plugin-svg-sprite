import type { LinksFunction, MetaFunction } from "@remix-run/node";
import spriteUrl from "virtual:@mcansh/vite-plugin-svg-sprite";
import beakerIconHref from "heroicons/24/outline/beaker.svg";
import eyeIconHref from "lucide-static/icons/eye.svg";
import houseIconHref from "lucide-static/icons/house.svg";
import archiveBoxArrowDownIconHref from "~/assets/archive-box-arrow-down.svg";
import { Icon } from "./icon";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export const links: LinksFunction = () => {
  return [
    { rel: "preload", as: "image", href: spriteUrl, type: "image/svg+xml" },
  ];
};

const icons = [
  archiveBoxArrowDownIconHref,
  beakerIconHref,
  eyeIconHref,
  houseIconHref,
] as const;

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Welcome to Remix</h1>
      <h2>{spriteUrl}</h2>

      {icons.map((icon) => {
        return <Icon key={icon} icon={icon} width={100} height={100} />;
      })}


    </div>
  );
}
