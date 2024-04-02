# @mcansh/vite-svg-sprite-plugin

## 0.1.5

### Patch Changes

- 53d9e7e: dont add icon to sprite multiple times
- e26739e: hash emitted svg during build

## 0.1.4

### Patch Changes

- 13f3f80: remove sprite basename check used during development in another app to prevent infinitely adding the sprite when using a different configuration
- d94f845: allow plugin to work with custom assetDir
- 69c264d: update how defaults are set

  rename plugin's returned name

- c0d8736: dont mutate symbolIdPattern, otherwise all symbols will have the same id

## 0.1.3

### Patch Changes

- 4a86394: add missing fs-extra dependency

## 0.1.2

### Patch Changes

- 2fd42d8: rename exported function to `createSvgSpritePlugin`
