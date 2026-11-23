import assert from "node:assert/strict"
import { test } from "node:test"

import { router } from "./router.tsx"

test("the home page renders server and client sprite icons", async () => {
  let response = await router.fetch(new Request("http://localhost/"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff")

  let html = await response.text()
  assert.match(html, /<use href="\/sprite\.svg#icon-star"/)
  assert.match(html, /<use href="\/sprite\.svg#icon-plus"/)
})

test("an unknown path is not found", async () => {
  let response = await router.fetch(new Request("http://localhost/missing"))
  assert.equal(response.status, 404)
})
