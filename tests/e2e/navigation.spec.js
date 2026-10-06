import { expect, test } from '@playwright/test';

// API fixtures must handle requests directly rather than through the service worker.
test.use({ serviceWorkers: 'block' });

const crag = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [16, 48] },
	properties: {
		name: 'Alpine Crag',
		id: 'alpine-crag',
		kind: 'crag',
		type: ['sports-climbing']
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
		if (url.endsWith('/api/fs/?recursive=true')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{ name: 'alpine-crag.json', path: 'areas/alpine-crag/alpine-crag.json', type: 'file' },
					{ name: 'north.json', path: 'areas/alpine-crag/north/north.json', type: 'file' }
				])
			});
		}
		if (url.endsWith('-topo.json')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					imageAspectRatio: 2,
					backgroundFit: 'contain',
					routes: [
						{
							id: 'route-1',
							name: 'Alpine Line',
							grade: { scale: 'french', value: '6a', standardizedValue: '6a' },
							points2D: [
								[0.2, 0.8],
								[0.5, 0.4],
								[0.7, 0.15]
							]
						}
					],
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
		if (url.endsWith('/north.json'))
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				json: {
					...crag,
					properties: { id: 'north', kind: 'sector', name: 'North Wall', type: ['sports-climbing'] }
				}
			});
		if (url.endsWith('-access.json'))
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				json: { type: 'FeatureCollection', features: [] }
			});
		if (url.endsWith('.json')) {
			return route.fulfill({ status: 404 });
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
	});
}

test.beforeEach(async ({ page }) => {
	await mockCragApi(page);
});

test('3D topo renders original route and fix-point geometry', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const vertices = new Float32Array([-5, 0, 0, 5, 0, 0, 0, 8, 0]);
	const model = {
		asset: { version: '2.0' },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0 }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
		buffers: [
			{
				byteLength: vertices.byteLength,
				uri: `data:application/octet-stream;base64,${Buffer.from(vertices.buffer).toString('base64')}`
			}
		],
		bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.byteLength }],
		accessors: [
			{
				bufferView: 0,
				componentType: 5126,
				count: 3,
				type: 'VEC3',
				min: [-5, 0, 0],
				max: [5, 8, 0]
			}
		]
	};
	await page.route('**/api/fs/areas/alpine-crag', (route) =>
		route.fulfill({
			json: [{ name: 'alpine-crag.glb', path: 'alpine-crag.glb', type: 'file' }]
		})
	);
	await page.route('**/alpine-crag.glb', (route) => route.fulfill({ json: model }));
	await page.route('**/alpine-crag-topo.json', (route) =>
		route.fulfill({
			json: {
				routes: [
					{
						id: 'route-1',
						name: 'Original 3D line',
						grade: { scale: 'french', value: '6a', standardizedValue: '6a' },
						points: [
							[0, 0, 0.1],
							[0, 2, 0.1],
							[0, 5, 0.1]
						],
						orientation: [0, 0, 1],
						fixPoints: ['anchor']
					}
				],
				fixPoints: [{ id: 'anchor', type: 'anchor', position: [0, 5, 0.1] }]
			}
		})
	);
	await page.goto('/map', { waitUntil: 'domcontentloaded' });
	await page.waitForFunction(() => window.__climbingMap);
	// Navigate through the client router so the browser API fixtures also cover page loading.
	await page.evaluate(() => {
		const link = document.createElement('a');
		link.href = '/topo/crag/areas/alpine-crag/route-1?mode=3d';
		link.textContent = 'Open original 3D topo';
		document.body.append(link);
	});
	await page.getByRole('link', { name: 'Open original 3D topo' }).click();
	await expect(page.locator('.route-label')).toContainText('Original 3D line', { timeout: 20000 });
	await expect(page.locator('#css-renderer-target .fa-anchor')).toBeAttached();
	expect(errors).toEqual([]);
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
			if (!rendered.some((feature) => feature.properties.filePath === 'areas/alpine-crag')) {
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
	await expect(svg.locator('.visible-line')).toHaveAttribute('d', /.+/);
	await expect(svg.locator('.rock-outline')).toHaveCount(1);
	await expect(svg.locator('.symbol-group')).toHaveCount(1);
	await expect(svg.locator('.topo-text-label')).toHaveText('Summit');

	await svg.locator('.hit-area').click({ force: true });
	await expect(page).toHaveURL(/route-1/);
});
