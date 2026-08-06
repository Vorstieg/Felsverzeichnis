/** Find a route, pitch, or variant by ID and preserve its parent relationship. */
export function findRouteOrChild(routes, id) {
	for (const parent of routes || []) {
		if (parent.id === id) return parent;
		for (const child of [...(parent.pitches || []), ...(parent.variants || [])]) {
			if (child.id === id) return { ...child, parentId: parent.id };
		}
	}
	return null;
}

/** Flatten sector feature properties into the shape consumed by the page. */
export function normalizeSectorData(sector) {
	return sector
		? {
				...sector,
				...(sector.properties || {}),
				geometry: sector.geometry || sector.properties?.geometry
			}
		: null;
}

/** Calculate a representative center for point and polygonal GeoJSON geometry. */
export function getGeometryCenter(geometry) {
	if (!geometry?.coordinates) return null;
	if (geometry.type === 'Point') return geometry.coordinates;

	const coordinates =
		geometry.type === 'Polygon'
			? geometry.coordinates?.[0]
			: geometry.type === 'MultiPolygon'
				? geometry.coordinates?.flatMap((polygon) => polygon[0])
				: geometry.coordinates;

	if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

	const usableCoordinates =
		coordinates.length > 1 &&
		coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
		coordinates[0][1] === coordinates[coordinates.length - 1][1]
			? coordinates.slice(0, -1)
			: coordinates;

	const sums = usableCoordinates.reduce(
		(acc, coordinate) => [acc[0] + coordinate[0], acc[1] + coordinate[1]],
		[0, 0]
	);
	return [sums[0] / usableCoordinates.length, sums[1] / usableCoordinates.length];
}
