import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	ssr: {
		resolve: {
			conditions: ['browser']
		}
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup.js'],
		include: ['tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['tests/e2e/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: [
				'src/lib/assets/js/climbing-map-utils.js',
				'src/lib/assets/js/fetchCrags.js',
				'src/lib/assets/js/grades.js',
				'src/lib/assets/js/id-utils.js',
				'src/lib/assets/js/storage-utils.js',
				'src/lib/assets/js/topo-paths.js',
				'src/lib/assets/js/topo-loader-utils.js',
				'src/lib/components/topo/Topo2DViewer.svelte'
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80
			}
		}
	}
});
