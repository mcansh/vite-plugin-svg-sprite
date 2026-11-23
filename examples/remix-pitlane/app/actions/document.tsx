import type { Handle, RemixNode } from "remix/component"
import { ImportMap } from "remix/component/server"

import { scriptEntry, stylesheetHref } from "#app/assets.ts"

export function Document(handle: Handle<{ children?: RemixNode }>) {
  return () => {
    let { children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Remix 3 sprite</title>
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="stylesheet" href={stylesheetHref} />
          <ImportMap value={scriptEntry.importMap} />
          {scriptEntry.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
        </head>
        <body>
          {children}
          <script type="module" src={scriptEntry.href} />
        </body>
      </html>
    )
  }
}
