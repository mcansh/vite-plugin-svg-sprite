import * as http from "node:http"

import { createRequestListener } from "remix/node-fetch-server"

import type { FetchHandler } from "./app/router.tsx"
// `vite build` emits this module, so it is absent while type-checking source.
// @ts-expect-error built output has no declaration file
import built from "./dist/ssr/index.js"

const ssr: FetchHandler = built

function listenPort() {
  let value = process.env.PORT
  if (value == null || value === "") return 4477
  let parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 4477
  return parsed
}

const port = listenPort()
const server = http.createServer(createRequestListener((request) => ssr.fetch(request)))

server.listen(port, () => {
  console.log(`remix-pitlane listening on http://127.0.0.1:${port}`)
})
