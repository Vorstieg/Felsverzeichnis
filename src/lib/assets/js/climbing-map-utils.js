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
 * @param {string[] | string} [types]
 * @returns {string[]}
 */
export function sortClimbingTypes(types = []) {
	const list = Array.isArray(types) ? types : types ? [types] : [];
	if (!list.length) return [];
	const unique = Array.from(new Set(list.filter(Boolean)));
	return unique.sort((a, b) => {
		const indexA = CLIMBING_TYPE_PRIORITY.indexOf(a);
		const indexB = CLIMBING_TYPE_PRIORITY.indexOf(b);
		return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
	});
}

/**
 * Returns the preferred climbing type based on priority: multi-pitch > sports-climbing > bouldering > ...
 * @param {string[] | string} [types]
 * @returns {string}
 */
export function getPreferredClimbingType(types = []) {
	return sortClimbingTypes(types)[0] ?? '';
}

/**
 * @typedef {import('@vorstieg/fels-types/types').FelsProperties & {
 *   filePath: string;
 *   hasSectors?: boolean;
 *   isCentroid?: boolean;
 * }} PlaceFeatureProperties
 */

/** @param {import('$lib/types/files').FelsLocation[]} [locations]
 * @returns {import('geojson').FeatureCollection<import('geojson').Geometry, PlaceFeatureProperties>} */
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

	/** @type {import('geojson').Feature<import('geojson').Geometry, PlaceFeatureProperties>[]} */
	const features = [];

	for (const { entry, path } of locations) {
		/** @type {PlaceFeatureProperties} */
		const properties = {
			...entry?.properties,
			filePath: path,
			hasSectors: sectorParentPaths.has(path)
		};

		features.push({
			...entry,
			properties
		});

		// For polygon crags and sectors, also include a centroid Point feature so that
		// symbol layers (places) and circle layers (places-dots) can render a single
		// marker/dot at the center instead of rendering on polygon geometry fragments.
		if (
			(entry?.properties?.kind === 'crag' || entry?.properties?.kind === 'sector') &&
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
