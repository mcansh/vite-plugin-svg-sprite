import { clientEntry } from "remix/component"

import plusHref from "../icons/plus.svg"
import { icon } from "./css-mixins.ts"

export const PlusButton = clientEntry(import.meta.url, function PlusButton() {
  return () => (
    <button type="button">
      <svg mix={icon()} aria-hidden="true">
        <use href={plusHref} />
      </svg>
      Add
    </button>
  )
})
