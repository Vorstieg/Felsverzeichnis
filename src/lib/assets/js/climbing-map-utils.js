import { getGeometryCenter } from './topo-loader-utils.js';

export const CLIMBING_TYPE_PRIORITY = [
	'multi-pitch',
	'sports-climbing',
	'bouldering',
	'trad',
	'alpine-tour',
	'via-ferrata'
];

/**
 * Returns climbing types sorted by priority: multi-pitch > sports-climbing > bouldering > ...
 * @param {string[]} [types]
 * @returns {string[]}
 */
export function sortClimbingTypes(types = []) {
	if (!types || !types.length) return [];
	const unique = Array.from(new Set(types.filter(Boolean)));
	return unique.sort((a, b) => {
		const indexA = CLIMBING_TYPE_PRIORITY.indexOf(a);
		const indexB = CLIMBING_TYPE_PRIORITY.indexOf(b);
		return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
	});
}

/**
 * Returns the preferred climbing type based on priority: multi-pitch > sports-climbing > bouldering > ...
 * @param {string[]} [types]
 * @returns {string}
 */
export function getPreferredClimbingType(types = []) {
	return sortClimbingTypes(types)[0] ?? '';
}

/** @param {import('$lib/types/files').FelsLocation[]} [locations]
 * @returns {import('geojson').FeatureCollection<import('geojson').Geometry, import('@vorstieg/fels-types/types').FelsProperties & {filePath: string, hasSectors?: boolean, isCentroid?: boolean}>} */
export function createPlacesData(locations = []) {
	const sectorParentPaths = new Set(
		locations
			.filter((loc) => loc.entry?.properties?.kind === 'sector')
			.map((loc) => {
				const p = loc.path;
				const idx = p.lastIndexOf('/');
				return idx !== -1 ? p.slice(0, idx) : '';
			})
			.filter(Boolean)
	);

	/** @type {import('geojson').Feature<import('geojson').Geometry, any>[]} */
	const features = [];

	for (const { entry, path } of locations) {
		const properties = {
			...entry?.properties,
			filePath: path,
			hasSectors: sectorParentPaths.has(path)
		};

		features.push({
			...entry,
			properties
		});

		// For polygon crags, also include a centroid Point feature so that
		// circle layers (places-dots) can render a single dot at the crag center
		// instead of rendering a circle at every vertex along the polygon perimeter.
		if (
			entry?.properties?.kind === 'crag' &&
			(entry?.geometry?.type === 'Polygon' || entry?.geometry?.type === 'MultiPolygon')
		) {
			const center = getGeometryCenter(entry.geometry);
			if (center) {
				features.push({
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: center
					},
					properties: {
						...properties,
						isCentroid: true
					}
				});
			}
		}
	}

	return {
		type: 'FeatureCollection',
		features
	};
}

/** @param {import('@vorstieg/fels-types/types').PathFeature[]} [topoPaths]
 * @returns {import('geojson').FeatureCollection} */
export function createTopoPathsData(topoPaths = []) {
	return {
		type: 'FeatureCollection',
		features: topoPaths.map((feature) => ({ ...feature, properties: feature.properties ?? {} }))
	};
}

/** @param {{width?: number, height?: number}} [viewport] */
export function getMapPadding({ width = 0, height = 0 } = {}) {
	if (width >= 1024) return { top: 0, bottom: 0, left: 0, right: 680 };
	if (width > 640) return { top: 0, bottom: 0, left: 0, right: 440 };
	return { top: 0, bottom: height * 0.5, left: 0, right: 0 };
}

/** @param {string} selectedPath
 * @returns {import('maplibre-gl').ExpressionSpecification | null} */
export function selectionExpression(selectedPath) {
	if (!selectedPath) return null;
	const decodedPath = decodeURIComponent(selectedPath);
	return ['==', ['index-of', ['concat', ['get', 'filePath'], '/'], decodedPath + '/'], 0];
}
