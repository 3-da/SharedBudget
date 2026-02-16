import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        root: './',
        include: ['src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            thresholds: {
                branches: 80,
                functions: 85,
                lines: 85,
                statements: 85,
            },
        },
    },
    resolve: {
        alias: [
            {
                find: /^@prisma\/client$/,  // exact match only, not subpaths
                replacement: path.resolve(__dirname, './prisma/generated/client/client.ts'),
            },
        ],
    },
    plugins: [swc.vite({ module: { type: 'es6' } })],
});
