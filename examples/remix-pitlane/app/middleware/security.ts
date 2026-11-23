import type { Middleware, NextFunction, RequestContext } from "remix/router"

export function securityHeaders(): Middleware {
  return async (_context: RequestContext, next: NextFunction) => {
    let response = await next()
    response.headers.set("X-Content-Type-Options", "nosniff")
    return response
  }
}
