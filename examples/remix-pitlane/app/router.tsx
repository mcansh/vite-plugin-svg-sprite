import { asyncContext } from "remix/middleware/async-context"
import { render } from "remix/middleware/render"
import { staticFiles } from "remix/middleware/static"
import type { MiddlewareContext } from "remix/router"
import { createRouter } from "remix/router"

import controller from "#app/actions/controller.tsx"
import { assets } from "#app/assets.ts"
import { securityHeaders } from "#app/middleware/security.ts"
import { routes } from "#app/routes.ts"

type AppContext = MiddlewareContext<[ReturnType<typeof asyncContext>, ReturnType<typeof render>]>

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext
  }
}

export interface FetchHandler {
  fetch(request: Request): Response | Promise<Response>
}

export const router = createRouter<AppContext>({
  middleware: [
    securityHeaders(),
    staticFiles("./public"),
    staticFiles("./dist/client"),
    asyncContext(),
    render({ assets }),
  ],
  defaultHandler() {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  },
})

router.map(routes, controller)

export default router
