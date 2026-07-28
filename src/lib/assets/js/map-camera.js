function collectCoordinates(value, points) {
	if (!Array.isArray(value)) return;
	if (typeof value[0] === 'number' && typeof value[1] === 'number') {
		points.push(value);
		return;
	}
	for (const child of value) collectCoordinates(child, points);
}

export function getGeometryBounds(geometry) {
	if (!geometry?.coordinates) return null;

	const points = [];
	collectCoordinates(geometry.coordinates, points);
	if (points.length === 0) return null;

	const bounds = points.reduce(
		(result, [longitude, latitude]) => [
			Math.min(result[0], longitude),
			Math.min(result[1], latitude),
			Math.max(result[2], longitude),
			Math.max(result[3], latitude)
		],
		[Infinity, Infinity, -Infinity, -Infinity]
	);

	return [
		[bounds[0], bounds[1]],
		[bounds[2], bounds[3]]
	];
}

export function getBoundsCenter(bounds) {
	if (!bounds) return null;
	return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

export function createLocationsCameraTarget(locations = []) {
	const validLocations = locations.filter((location) => getGeometryBounds(location?.geometry));
	if (validLocations.length === 0) return null;

	if (validLocations.length === 1) {
		const bounds = getGeometryBounds(validLocations[0].geometry);
		return {
			type: 'center',
			center: getBoundsCenter(bounds),
			zoom: 16,
		};
	}

	const bounds = validLocations.reduce(
		(result, location) => {
			const locationBounds = getGeometryBounds(location.geometry);
			return [
				[
					Math.min(result[0][0], locationBounds[0][0]),
					Math.min(result[0][1], locationBounds[0][1])
				],
				[Math.max(result[1][0], locationBounds[1][0]), Math.max(result[1][1], locationBounds[1][1])]
			];
		},
		[
			[Infinity, Infinity],
			[-Infinity, -Infinity]
		]
	);

	return { type: 'bounds', bounds, padding: 80, maxZoom: 13 };
}
