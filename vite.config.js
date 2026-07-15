import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [enhancedImages(), sveltekit(), tailwindcss()],
	assetsInclude: ['**/*.glb'],
	server: {
		fs: {
		allow: ['.']
		}
	},

	optimizeDeps: {
		exclude: ['three', 'd3-zoom', 'd3-selection']
	}
};

export default config;
