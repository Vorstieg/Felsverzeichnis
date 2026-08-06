import { vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import '@testing-library/jest-dom/vitest';

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('http://localhost/map'),
		params: {},
		data: {
			allLocations: [
				{
					properties: { name: 'Alpine Crag', path: 'areas/alpine-crag', type: 'sports-climbing' },
					geometry: { type: 'Point', coordinates: [16, 48] }
				}
			]
		}
	}),
	navigating: readable(null),
	updated: readable(false)
}));
vi.mock('svelte-i18n', () => ({
	_: readable((key) => key),
	locale: writable('en')
}));

Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });
globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
Element.prototype.animate =
	Element.prototype.animate ||
	(() => ({
		finished: Promise.resolve(),
		cancel() {}
	}));
