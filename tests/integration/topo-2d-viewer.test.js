import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Topo2DViewer from '$lib/components/topo/Topo2DViewer.svelte';

const topo = {
	canvasAspectRatio: 2,
	image2D: 'data:image/svg+xml;base64,fixture',
	backgroundFit: 'cover',
	outlines: [
		{
			id: 'wall',
			points2D: [
				[0.1, 0.1],
				[0.9, 0.1],
				[0.9, 0.9],
				[0.1, 0.9],
				[0.1, 0.1]
			]
		}
	],
	fixPoints: [{ id: 'bolt-1', type: 'bolt', position2D: [0.5, 0.5], rotation2D: 15 }],
	textLabels: [
		{
			id: 'summit',
			text: 'Summit',
			position2D: [0.5, 0.2],
			rotation2D: 10,
			fontSize2D: 0.03,
			color: '#123456'
		},
		{ id: 'default-label', text: 'Default', position2D: [0.25, 0.25] },
		{ id: 'empty-label', text: '', position2D: [0.75, 0.25] },
		{ id: 'invalid', text: 'Ignored', position2D: [0.5] }
	]
};

const routes = [
	{ id: 'route-1', points2D: [[0.2, 0.8], [0.5, 0.4], [0.7, 0.15]] }
];

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

async function renderViewer(props = {}) {
	const result = render(Topo2DViewer, {
		props: { topo, routes, ...props }
	});
	await new Promise(requestAnimationFrame);
	await new Promise(requestAnimationFrame);
	await tick();
	return result;
}

describe('Topo2DViewer', () => {
	it('renders the shared SVG content and application-owned decorations', async () => {
		const { container } = await renderViewer();
		const svg = container.querySelector('svg');

		expect(svg).toHaveAttribute('viewBox', '0 0 1000 500');
		expect(svg.querySelector('.bg-image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
		expect(svg.querySelectorAll('.route-group')).toHaveLength(1);
		expect(svg.querySelectorAll('.rock-outline')).toHaveLength(1);
		expect(svg.querySelectorAll('.symbol-group')).toHaveLength(1);
		expect(svg.querySelectorAll('.topo-text-label')).toHaveLength(3);
		expect(svg.querySelector('.topo-text-label')).toHaveTextContent('Summit');
		expect(svg.querySelector('.topo-text-label')).toHaveAttribute(
		'transform',
		'translate(500, 100) rotate(10)'
		);
	});

	it('uses the neutral grid for route-only topos', async () => {
		const { container } = await renderViewer({
			topo: {
				...topo,
				canvasAspectRatio: 0,
				image2D: null,
				imageAspectRatio: 0,
				textLabels: []
			}
		});

		expect(container.querySelector('.viewer-blank-background')).toHaveAttribute(
			'fill',
			'url(#topo-viewer-grid)'
		);
		expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 1000 666.6666666666666');
	});

	it('forwards route selection and hover state', async () => {
		const onRouteSelect = vi.fn();
		const { container } = await renderViewer({
			onRouteSelect,
			selectedRouteId: 'route-1'
		});

		const route = container.querySelector('.route-group');
		await fireEvent.click(route);
		expect(onRouteSelect).toHaveBeenCalledWith(routes[0]);

		await fireEvent.mouseEnter(route);
		// The component owns the hover callback; the SVG remains the observable contract.
		expect(route.querySelector('.visible-line')).toHaveAttribute('stroke', '#3b82f6');
	});

	it('applies d3 zoom transforms to the content group', async () => {
		const { container } = await renderViewer();
		const svg = container.querySelector('svg');
		const content = svg.querySelector(':scope > g');
		Object.defineProperty(svg, 'viewBox', {
			value: { baseVal: { x: 0, y: 0, width: 1000, height: 500 } }
		});

		await fireEvent.wheel(svg, { deltaY: -120, clientX: 400, clientY: 200 });

		expect(content.getAttribute('transform')).toContain('scale(');
	});
});
