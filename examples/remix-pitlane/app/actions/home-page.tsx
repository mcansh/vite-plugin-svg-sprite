import { Document } from "./document.tsx"
import starHref from "./icons/star.svg"
import { icon, stack } from "./public/css-mixins.ts"
import { PlusButton } from "./public/plus-button.tsx"

export function HomePage() {
  return () => (
    <Document>
      <main mix={stack("1.25rem")}>
        <h1>SVG sprite</h1>
        <p>The star is rendered on the server. The plus button hydrates in the browser.</p>
        <svg mix={icon()} aria-hidden="true">
          <use href={starHref} />
        </svg>
        <PlusButton />
      </main>
    </Document>
  )
}
