import type { Handle } from "remix/component"
import { clientEntry, css, on } from "remix/component"

import plusHref from "../icons/plus.svg"
import starHref from "../icons/star.svg"

function randomHex() {
  let randomColor = Math.floor(Math.random() * 16777215).toString(16)
  let hex = randomColor.padStart(6, "0").toLowerCase()
  return `#${hex}`
}

const icon = css({ height: "2rem", width: "2rem" })

const visuallyHidden = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
})

export const PlusButton = clientEntry(import.meta.url, function PlusButton(handle: Handle) {
  let colors: Array<string> = []

  return () => (
    <>
      <div mix={css({ display: "flex", gap: "1.5rem", flexWrap: "wrap" })}>
        {colors.map((color, index) => (
          <button
            key={color}
            type="button"
            mix={[
              css({ all: "unset" }),
              on("click", () => {
                colors = colors.toSpliced(index, 1)
                handle.update()
              }),
            ]}
          >
            <span mix={visuallyHidden}>remove</span>
            <svg aria-hidden="true" mix={[icon, css({ flexShrink: 0, color })]}>
              <use href={starHref} />
            </svg>
          </button>
        ))}
      </div>

      <button
        type="button"
        mix={[
          on("click", () => {
            function addColor() {
              let length = colors.length
              colors.push(randomHex())
              if (length === colors.length) {
                addColor()
              }
            }
            addColor()
            handle.update()
          }),
          css({ display: "flex", justifyContent: "center", alignItems: "center" }),
        ]}
      >
        <svg aria-hidden="true" mix={icon}>
          <use href={plusHref} />
        </svg>
        Add
      </button>
    </>
  )
})
