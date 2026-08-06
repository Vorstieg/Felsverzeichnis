import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import CragList from '$lib/components/CragList.svelte';
import SearchBar from '$lib/components/ui/SearchBar.svelte';
import TopoButton from '$lib/components/ui/TopoButton.svelte';

const crags = [
	{
		properties: { name: 'Adlitzgräben', path: 'niederoesterreich/adlitzgraeben', sectors: [] },
		geometry: { type: 'Point', coordinates: [16, 48] }
	},
	{
		properties: {
			name: 'Boulderpark',
			path: 'wienerwald/boulderpark',
			sectors: [{ name: 'North Wall' }]
		},
		geometry: { type: 'Point', coordinates: [16.1, 48.1] }
	}
];

describe('frontend navigation components', () => {
	afterEach(() => cleanup());

	it('renders crags and links a selected crag', () => {
		render(CragList, { props: { crags, isCompact: true } });
		expect(screen.getByText('Adlitzgräben')).toBeInTheDocument();
		expect(screen.getByText('North Wall')).toBeInTheDocument();
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
});
