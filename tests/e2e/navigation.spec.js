import { expect, test } from '@playwright/test';

const crag = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [16, 48] },
	properties: {
		name: 'Alpine Crag',
		path: 'areas/alpine-crag',
		type: 'sports-climbing',
		sectors: [{ id: 'north', name: 'North Wall', type: 'sports-climbing' }]
	}
};

async function mockCragApi(page) {
	await page.route('**/api/fs/**', async (route) => {
		const url = route.request().url();
		if (url.endsWith('/fels-layer.json')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ type: 'FeatureCollection', features: [crag] })
			});
		}
		if (url.endsWith('-topo.json')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ name: 'Alpine Crag topo', routes: [{ id: 'route-1', grade: '6a' }] })
			});
		}
		if (url.endsWith('alpine-crag.json')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(crag)
			});
		}
		if (url.endsWith('.json')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({})
			});
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
	});
}

test.beforeEach(async ({ page }) => {
	await mockCragApi(page);
});

test('homepage redirects to the map and the map loads crags', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/map(?:#|$)/);
	await expect(page.getByRole('textbox')).toBeVisible();
});

test('search navigates to a crag', async ({ page }) => {
	await page.goto('/map');
	const search = page.getByRole('textbox');
	await search.fill('Alpine');
	await expect(page.getByText('Alpine Crag')).toBeVisible();
	await page.getByText('Alpine Crag').click();
	await expect(page).toHaveURL(/\/map\/crag\/areas\/alpine-crag/);
});

test('crag pages expose sector navigation', async ({ page }) => {
	await page.goto('/topo/crag/areas/alpine-crag');
	await expect(page.getByText('North Wall')).toBeVisible();
	await page.getByText('North Wall').click();
	await expect(page).toHaveURL(/\/topo\/crag\/areas\/alpine-crag\/north$/);
});
