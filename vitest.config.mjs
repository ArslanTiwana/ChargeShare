import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/mobile/**'],
    fileParallelism: false,
    testTimeout: 25000,
    hookTimeout: 25000,
    alias: {
      '@': path.resolve(process.cwd(), './'),
      '@shared': path.resolve(process.cwd(), './shared/src/index.ts'),
      '@shared/*': path.resolve(process.cwd(), './shared/src/*'),
    },
  },
});
