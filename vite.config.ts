import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Ant Design's computed-style queries are CPU-heavy in jsdom. Keep the
    // interaction suites sequential on small CI runners without relaxing assertions.
    fileParallelism: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/'))
            return id.includes('/antd/') ||
              id.includes('/@ant-design/') ||
              id.includes('/rc-') ||
              id.includes('/@rc-component/')
              ? 'antd'
              : 'vendor';
        },
      },
    },
  },
});
