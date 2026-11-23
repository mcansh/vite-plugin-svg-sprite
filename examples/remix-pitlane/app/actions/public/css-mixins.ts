import { css } from "remix/component"

export function stack(gap: string) {
  return css({
    display: "flex",
    flexDirection: "column",
    gap,
  })
}

export function icon() {
  return css({
    width: "2.5rem",
    height: "2.5rem",
    display: "block",
  })
}
