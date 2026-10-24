import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        // This is a browser-only SPA, without React Server Components. Mantine's
        // "use client" module markers have no server boundary to preserve here.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')
          && /[\\/]node_modules[\\/]@mantine[\\/]/.test(warning.id ?? '')) return;
        defaultHandler(warning);
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
