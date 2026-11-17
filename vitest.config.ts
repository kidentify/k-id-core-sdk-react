import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// The core SDK is bundled into dist (sources in dist/core-src) rather than
// published separately, so tests resolve it from there.
const core = (path: string) => fileURLToPath(new URL(`./dist/core-src/${path}`, import.meta.url))

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  // Stamped at build time in the published bundle.
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: [
      { find: /^@kid\/core-sdk-js\/react$/, replacement: core('react/index.ts') },
      { find: /^@kid\/core-sdk-js\/browser$/, replacement: core('browser/index.ts') },
      { find: /^@kid\/core-sdk-js$/, replacement: core('index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // Remove once the first tests land.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
})
