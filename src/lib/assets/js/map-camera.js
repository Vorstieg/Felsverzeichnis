/**
 * @typedef {import('@vorstieg/fels-types/types').PointOrAreaGeometry
 *   | import('geojson').LineString
 *   | import('geojson').MultiLineString
 *   | import('geojson').MultiPoint} SupportedGeometry
 */

/** @param {SupportedGeometry | null | undefined} geometry
 * @returns {[[number, number], [number, number]] | null} */
export function getGeometryBounds(geometry) {
	if (!geometry || !geometry.coordinates) return null;
	/** @type {import('geojson').Position[]} */
	let points = [];
	if (geometry.type === 'Point') {
		points = [geometry.coordinates];
	} else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
		points = geometry.coordinates;
	} else if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
		points = geometry.coordinates.flat();
	} else if (geometry.type === 'MultiPolygon') {
		points = geometry.coordinates.flat(2);
	}
	if (!points.length) return null;
	const longitudes = points.map(([longitude]) => longitude).filter(Number.isFinite);
	const latitudes = points.map(([, latitude]) => latitude).filter(Number.isFinite);
	if (!longitudes.length || !latitudes.length) return null;
	return [
		[Math.min(...longitudes), Math.min(...latitudes)],
		[Math.max(...longitudes), Math.max(...latitudes)]
	];
}

/** @param {[[number, number], [number, number]] | null} bounds
 * @returns {[number, number] | null} */
export function getBoundsCenter(bounds) {
	return bounds ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2] : null;
}

/** @param {import('$lib/types/files').FelsLocation[]} [locations]
 * @returns {import('$lib/types/application').MapCameraTarget | null} */
export function createLocationsCameraTarget(locations = []) {
	const bounds = locations.flatMap((location) => {
		const value = getGeometryBounds(location.entry.geometry);
		return value ? [value] : [];
	});
	if (!bounds.length) return null;
	if (bounds.length === 1) {
		const center = getBoundsCenter(bounds[0]);
		return center ? { type: 'center', center, zoom: 16 } : null;
	}
	return {
		type: 'bounds',
		bounds: [
			[Math.min(...bounds.map(([min]) => min[0])), Math.min(...bounds.map(([min]) => min[1]))],
			[Math.max(...bounds.map(([, max]) => max[0])), Math.max(...bounds.map(([, max]) => max[1]))]
		],
		padding: 80,
		maxZoom: 13
	};
}
