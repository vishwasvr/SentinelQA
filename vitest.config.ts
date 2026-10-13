import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      // App code only (delivery-strategy §3b): no generated OpenAPI types, IaC, tests or fixtures.
      include: ['src/**/*.{ts,js}'],
      exclude: ['src/generated/**', 'src/**/*.test.ts', 'src/**/*.d.ts', '**/fixtures/**'],
      all: true,
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
