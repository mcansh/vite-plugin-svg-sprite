---
id: 01M853SVSYZWAMCHEB1531Z5BF
anchor: "@file"
created: 2026-11-23T21:08:15Z
norm: "1"
---

Keep the hydration fallback in a separate module: inline JSX shared with the route component prevents React Router from splitting HydrateFallback in dev when splitRouteModules is enforce.
