import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/search/catalog-search', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		isSearchConfigured: vi.fn(() => true),
		searchCatalog: vi.fn(async () => ({
			entries: [
				{
					id: 'alpine-crag',
					docType: 'entry',
					kind: 'crag',
					name: 'Alpine Crag',
					path: 'areas/alpine-crag',
					breadcrumb: [],
					types: ['sports-climbing'],
					grades: [],
					routeCount: 0,
					_geo: { lat: 48, lng: 16 }
				}
			],
			routes: [],
			entryTotal: 1,
			routeTotal: 0
		}))
	};
});

import { goto } from '$app/navigation';
import CragList from '$lib/components/CragList.svelte';
import SearchBar from '$lib/components/ui/SearchBar.svelte';
import TopoButton from '$lib/components/ui/TopoButton.svelte';
import GradeChart from '$lib/components/charts/GradeChart.svelte';
import RouteDetail from '$lib/components/topo/RouteDetail.svelte';
import ListCard from '$lib/components/ListCard.svelte';

const crags = [
	{
		path: 'niederoesterreich/adlitzgraeben',
		entry: {
			type: 'Feature',
			properties: { id: 'adlitzgraeben', kind: 'crag', name: 'Adlitzgräben' },
			geometry: { type: 'Point', coordinates: [16, 48] }
		}
	},
	{
		path: 'wienerwald/boulderpark',
		entry: {
			type: 'Feature',
			properties: { id: 'boulderpark', kind: 'crag', name: 'Boulderpark' },
			geometry: { type: 'Point', coordinates: [16.1, 48.1] }
		}
	}
];

describe('frontend navigation components', () => {
	afterEach(() => cleanup());

	it('renders crags and links a selected crag', () => {
		render(CragList, { props: { crags, isCompact: true } });
		expect(screen.getByText('Adlitzgräben')).toBeInTheDocument();
		expect(screen.getByText('Boulderpark').closest('a')).toHaveAttribute(
			'href',
			'/map/crag/wienerwald/boulderpark'
		);
	});

	it('shows search suggestions after typing and exposes the crag link', async () => {
		render(SearchBar, { props: { actionBase: '/list', searchTerm: '' } });
		const input = screen.getAllByRole('textbox')[0];
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'alp' } });
		expect(await screen.findByText('Alpine Crag')).toBeInTheDocument();
		expect(screen.getByText('Alpine Crag').closest('a')).toHaveAttribute(
			'href',
			'/map/crag/areas/alpine-crag#16/48/16'
		);
	});

	it('navigates with the keyboard-selected suggestion', async () => {
		render(SearchBar, { props: { searchTerm: '' } });
		const input = screen.getAllByRole('textbox')[0];
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'alp' } });
		expect(await screen.findByText('Alpine Crag')).toBeInTheDocument();
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag#16/48/16');
	});

	it('shows a loading indicator when opening a topo', async () => {
		render(TopoButton, { props: { path: 'areas/alpine-crag', mode: '3d' } });
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/topo/crag/areas/alpine-crag?mode=3d');
		link.addEventListener('click', (event) => event.preventDefault(), { once: true });
		await fireEvent.click(link);
		expect(link.querySelector('.fa-spinner')).toBeInTheDocument();
	});

	it('invokes onRouteSelect when a route is clicked in GradeChart', async () => {
		const onRouteSelect = vi.fn();
		const routes = [
			{
				id: 'route-1',
				name: 'First Route',
				type: 'sports-climbing',
				grade: { value: '6a', standardizedValue: '6a' }
			}
		];
		render(GradeChart, { props: { routes, onRouteSelect } });
		expect(screen.queryByText('First Route')).not.toBeInTheDocument();
		const expandButton = screen.getAllByRole('button', {
			name: /topo\.show_routes|Routen anzeigen|Show routes/i
		})[0];
		await fireEvent.click(expandButton);
		const row = screen.getByText('First Route').closest('tr');
		expect(row).toBeInTheDocument();
		await fireEvent.click(row);
		expect(onRouteSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'route-1' }));
	});

	it('groups multiple boulder routes together into a single chart when type is an array', async () => {
		const routes = [
			{
				id: 'boulder-1',
				name: 'First Boulder',
				type: ['bouldering'],
				grade: { value: 'Fb 6a', standardizedValue: '6a' }
			},
			{
				id: 'boulder-2',
				name: 'Second Boulder',
				type: ['bouldering'],
				grade: { value: 'Fb 6b', standardizedValue: '6b' }
			}
		];
		render(GradeChart, { props: { routes } });
		expect(screen.getByText(/bouldering \(2\)/)).toBeInTheDocument();
		expect(screen.queryByText(/bouldering \(1\)/)).not.toBeInTheDocument();
	});

	it('translates rock type case-insensitively in RouteDetail', async () => {
		const route = { id: 'route-1', name: 'First Route' };
		render(RouteDetail, { props: { route, rockType: 'Limestone' } });
		expect(screen.getByText(/limestone/i)).toBeInTheDocument();
		expect(screen.queryByText('rock_types.Limestone')).not.toBeInTheDocument();
	});

	it('renders clickable breadcrumb buttons in ListCard in the new style', () => {
		render(ListCard, { props: { crag: crags[0] } });

		const areaBreadcrumb = screen.getByText('niederoesterreich').closest('a');
		expect(areaBreadcrumb).toHaveAttribute('href', '/map/niederoesterreich');
		expect(areaBreadcrumb?.className).toContain('rounded-md');
		expect(areaBreadcrumb?.className).toContain('bg-slate-100');

		const cragBreadcrumb = screen.getByText('Adlitzgräben', { selector: 'a *' }).closest('a');
		expect(cragBreadcrumb).toHaveAttribute('href', '/map/crag/niederoesterreich/adlitzgraeben');
	});
});
