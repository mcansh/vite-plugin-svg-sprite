import { createController } from "remix/router"

import { routes } from "#app/routes.ts"

import { HomePage } from "./home-page.tsx"

export default createController(routes, {
  actions: {
    home(context) {
      return context.render(<HomePage />)
    },
  },
})
