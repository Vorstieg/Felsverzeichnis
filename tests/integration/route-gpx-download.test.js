import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RouteGpxDownload from '$lib/components/topo/RouteGpxDownload.svelte';
import RouteList from '$lib/components/topo/RouteList.svelte';
import { downloadRouteGpx } from '$lib/assets/js/route-gpx.js';

vi.mock('$lib/assets/js/route-gpx.js', async (importOriginal) => ({
	...(await importOriginal()),
	downloadRouteGpx: vi.fn()
}));

const route = { id: 'ridge', name: 'Ridge' };
const coordinates = [
	[16, 48],
	[16.1, 48.1]
];
const main = { name: 'Ridge', role: 'main', coordinates };

describe('RouteGpxDownload', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('downloads a single complete tour directly', async () => {
		const approach = { name: 'Walk', role: 'approach', coordinates };
		const descent = { name: 'Down', role: 'descent', coordinates };
		render(RouteGpxDownload, { props: { route, tracks: [main, approach, descent] } });

		await fireEvent.click(screen.getByRole('button', { name: 'ui.download_tour_gpx: Ridge' }));
		expect(downloadRouteGpx).toHaveBeenCalledWith(route, [approach, main, descent], '-tour');
		expect(screen.queryByRole('group', { name: 'ui.choose_tour_gpx' })).not.toBeInTheDocument();
	});

	it('shows complete tour options only after clicking when paths vary', async () => {
		const walkA = { name: 'Walk A', role: 'approach', coordinates };
		const walkB = { name: 'Walk B', role: 'approach', coordinates };
		const downA = { name: 'Down A', role: 'descent', coordinates };
		const downB = { name: 'Down B', role: 'descent', coordinates };
		render(RouteGpxDownload, { props: { route, tracks: [walkA, main, walkB, downA, downB] } });

		const trigger = screen.getByRole('button', { name: 'ui.download_tour_gpx: Ridge' });
		vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
			left: 100,
			right: 150,
			top: 170,
			bottom: 200
		});
		await fireEvent.click(trigger);
		const dropdown = screen.getByRole('group', { name: 'ui.choose_tour_gpx' });
		await waitFor(() => expect(dropdown).toHaveStyle({ left: '100px', top: '206px' }));
		const options = within(dropdown).getAllByRole('button');
		expect(options).toHaveLength(4);
		await fireEvent.click(options[3]);
		expect(downloadRouteGpx).toHaveBeenCalledWith(route, [walkB, main, downB], '-tour-2-2');
		expect(screen.queryByRole('group', { name: 'ui.choose_tour_gpx' })).not.toBeInTheDocument();
	});

	it('closes the dropdown with Escape or an outside click', async () => {
		const walkA = { name: 'Walk A', role: 'approach', coordinates };
		const walkB = { name: 'Walk B', role: 'approach', coordinates };
		render(RouteGpxDownload, { props: { route, tracks: [main, walkA, walkB] } });
		await fireEvent.click(screen.getByRole('button', { name: 'ui.download_tour_gpx: Ridge' }));
		expect(screen.getByRole('group', { name: 'ui.choose_tour_gpx' })).toBeInTheDocument();
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByRole('group', { name: 'ui.choose_tour_gpx' })).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'ui.download_tour_gpx: Ridge' }));
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('group', { name: 'ui.choose_tour_gpx' })).not.toBeInTheDocument();
	});

	it('does not select a route when its GPX button is clicked', async () => {
		const onRouteSelect = vi.fn();
		render(RouteList, { props: { routes: [{ ...route, downloadTracks: [main] }], onRouteSelect } });
		await fireEvent.click(screen.getByRole('button', { name: 'ui.download_tour_gpx: Ridge' }));
		expect(onRouteSelect).not.toHaveBeenCalled();
		expect(downloadRouteGpx).toHaveBeenCalledWith(expect.objectContaining(route), [main], '-tour');
	});
});
