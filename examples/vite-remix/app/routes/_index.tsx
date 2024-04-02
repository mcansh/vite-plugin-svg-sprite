import type { MetaFunction } from "@remix-run/node";
import archiveBoxArrowDownIconHref from "~/assets/archive-box-arrow-down.svg";
import beakerIconHref from "heroicons/24/outline/beaker.svg";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <svg width="100" height="100" fill="none" stroke="black" aria-hidden>
        <use href={archiveBoxArrowDownIconHref} />
      </svg>

      <svg width="100" height="100" fill="none" stroke="black" aria-hidden>
        <use href={beakerIconHref} />
      </svg>
    </div>
  );
}
