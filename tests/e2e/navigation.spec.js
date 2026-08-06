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
	await page.route('**/terrain.json', async (route) => {
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			json: {
				version: 8,
				sources: {},
				layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8f1e8' } }]
			}
		});
	});
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
				body: JSON.stringify({
					name: 'Alpine Crag topo',
					canvasAspectRatio: 2,
					backgroundFit: 'contain',
					routes: [
						{
							id: 'route-1',
							name: 'Alpine Line',
							grade: '6a',
							points2D: [[0.2, 0.8], [0.5, 0.4], [0.7, 0.15]]
						}
					],
					outlines: [
						{
							id: 'wall',
							points2D: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]]
						}
					],
					fixPoints: [{ id: 'bolt-1', type: 'bolt', position2D: [0.5, 0.5] }],
					textLabels: [{ id: 'summit', text: 'Summit', position2D: [0.5, 0.2] }]
				})
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

test('map route loads crags', async ({ page }) => {
	await page.goto('/map', { waitUntil: 'domcontentloaded' });
	await expect(page.getByRole('textbox')).toBeVisible({ timeout: 15000 });
});

test('clicking a rendered place navigates at both map zoom thresholds', async ({ page }) => {
	await page.goto('/map', { waitUntil: 'domcontentloaded' });
	await page.waitForFunction(() => window.__climbingMap?.getSource('places'));

	const clickPlace = async (zoom) => {
		const point = await page.evaluate(async (targetZoom) => {
			const map = window.__climbingMap;
			map.jumpTo({ center: [16, 48], zoom: targetZoom });
			await new Promise((resolve) => map.once('idle', resolve));
			const rendered = map.queryRenderedFeatures(map.project([16, 48]), {
				layers: [targetZoom < 12 ? 'places-dots' : 'places']
			});
			if (!rendered.some((feature) => feature.properties.path === 'areas/alpine-crag')) {
				throw new Error('fixture place is not rendered at the expected zoom');
			}
			const projected = map.project([16, 48]);
			return { x: projected.x, y: projected.y };
		}, zoom);

		await page.mouse.click(point.x, point.y);
		await expect(page).toHaveURL(/\/map\/crag\/areas\/alpine-crag/);
	};

	await clickPlace(8);
	await clickPlace(13);
});

test('search navigates to a crag', async ({ page }) => {
	await page.goto('/map', { waitUntil: 'domcontentloaded' });
	const search = page.getByRole('textbox');
	await search.fill('Alpine');
	await expect(page.getByText('Alpine Crag')).toBeVisible();
	await page.getByText('Alpine Crag').click();
	await expect(page).toHaveURL(/\/map\/crag\/areas\/alpine-crag/);
});

test('crag pages expose sector navigation', async ({ page }) => {
	await page.goto('/topo/crag/areas/alpine-crag', { waitUntil: 'domcontentloaded' });
	await expect(page.getByText('North Wall')).toBeVisible({ timeout: 15000 });
	await page.getByText('North Wall').click();
	await expect(page).toHaveURL(/\/topo\/crag\/areas\/alpine-crag\/north$/);
});

test('2D topo renders SVG geometry and supports route selection', async ({ page }) => {
	await page.goto('/topo/crag/areas/alpine-crag?mode=2d', { waitUntil: 'domcontentloaded' });

	const svg = page.locator('svg').first();
	await expect(svg).toBeVisible({ timeout: 15000 });
	await expect(svg.locator('g.route-group')).toHaveCount(1);
	await expect(svg.locator('.visible-line')).toHaveAttribute('points', /.+/);
	await expect(svg.locator('.rock-outline')).toHaveCount(1);
	await expect(svg.locator('.symbol-group')).toHaveCount(1);
	await expect(svg.locator('.topo-text-label')).toHaveText('Summit');

	await svg.locator('.hit-area').click({ force: true });
	await expect(page).toHaveURL(/route-1/);
});
