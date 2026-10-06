/** @param {import('@vorstieg/fels-types/types').PointOrAreaGeometry | null | undefined} geometry
 * @returns {[[number, number], [number, number]] | null} */
export function getGeometryBounds(geometry) {
	if (!geometry) return null;
	const points =
		geometry.type === 'Point'
			? [geometry.coordinates]
			: geometry.type === 'Polygon'
				? geometry.coordinates.flat()
				: geometry.coordinates.flat(2);
	if (!points.length) return null;
	const longitudes = points.map(([longitude]) => longitude);
	const latitudes = points.map(([, latitude]) => latitude);
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
