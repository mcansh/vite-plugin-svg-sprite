import beakerIconHref from "heroicons/24/outline/beaker.svg";
import eyeIconHref from "lucide-static/icons/eye.svg";
import houseIconHref from "lucide-static/icons/house.svg";
import archiveBoxArrowDownIconHref from "~/assets/archive-box-arrow-down.svg";
import { Icon } from "~/icon";
import type { Route } from "./+types/home";

const icons = [
  archiveBoxArrowDownIconHref,
  beakerIconHref,
  eyeIconHref,
  houseIconHref,
] as const;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return icons.map((icon) => {
    return <Icon key={icon} icon={icon} width={100} height={100} />;
  });
}
