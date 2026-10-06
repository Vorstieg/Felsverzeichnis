/** @param {import('$lib/types/files').FelsLocation[]} [locations]
 * @returns {import('geojson').FeatureCollection<import('geojson').Geometry, import('@vorstieg/fels-types/types').FelsProperties & {filePath: string}>} */
export function createPlacesData(locations = []) {
	return {
		type: 'FeatureCollection',
		features: locations.map(({ entry, path }) => ({
			...entry,
			properties: { ...entry.properties, filePath: path }
		}))
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
