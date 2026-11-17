import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const core = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    // @kid/core-sdk-js is not published; its sources ship in dist/core-src.
    alias: [
      { find: /^@kid\/core-sdk-js\/(react|browser)$/, replacement: core('./dist/core-src/$1/index.ts') },
      { find: /^@kid\/core-sdk-js\/localizations$/, replacement: core('./dist/core-src/localization/index.ts') },
      { find: /^@kid\/core-sdk-js$/, replacement: core('./dist/core-src/index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
})
