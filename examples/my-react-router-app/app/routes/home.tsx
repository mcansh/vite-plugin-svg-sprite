import beakerIconHref from "heroicons/24/outline/beaker.svg"
import alarmClockIconHref from "lucide-static/icons/alarm-clock.svg"
import eyeIconHref from "lucide-static/icons/eye.svg"
import houseIconHref from "lucide-static/icons/house.svg"
import wrenchIconHref from "lucide-static/icons/wrench.svg"

import archiveBoxArrowDownIconHref from "~/assets/archive-box-arrow-down.svg"
import { Icon } from "~/icon.tsx"

import type { Route } from "./+types/home"

const CLIENT_ICONS = [
  archiveBoxArrowDownIconHref,
  beakerIconHref,
  eyeIconHref,
  houseIconHref,
] as const

export async function clientLoader(ctx: Route.ClientLoaderArgs) {
  let serverIcons = await ctx.serverLoader()
  return [...serverIcons, wrenchIconHref]
}

clientLoader.hydrate = true as const

export function loader() {
  return [alarmClockIconHref] as const
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ]
}

export default function Home({ loaderData }: Route.ComponentProps) {
  let icons = [...CLIENT_ICONS, ...loaderData]
  return icons.map((icon) => <Icon key={icon} icon={icon} width={100} height={100} />)
}
