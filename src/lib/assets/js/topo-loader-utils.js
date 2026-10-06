/** Find a route, pitch, or variant by ID and preserve its parent relationship. */
/** @param {import("@vorstieg/fels-types/types").Route[]} routes
 * @param {string} id
 * @returns {import("$lib/types/application").SelectedClimbingLine | null} */
export function findRouteOrChild(routes, id) {
	for (const parent of routes) {
		if (String(parent.id) === id) return parent;
		for (const child of [...(parent.pitches || []), ...(parent.variants || [])]) {
			if (String(child.id) === id) return { ...child, parentId: parent.id };
		}
	}
	return null;
}

/** Calculate the mean of outer-ring vertices, excluding closing coordinates.
 * @param {import('@vorstieg/fels-types/types').PointOrAreaGeometry | null | undefined} geometry
 * @returns {[number, number] | null} */
export function getGeometryCenter(geometry) {
	if (!geometry) return null;
	if (geometry.type === 'Point') return [geometry.coordinates[0], geometry.coordinates[1]];
	const rings =
		geometry.type === 'Polygon'
			? geometry.coordinates.slice(0, 1)
			: geometry.coordinates.map((polygon) => polygon[0]);
	const vertices = rings.flatMap((ring) => ring.slice(0, -1));
	if (!vertices.length) return null;
	const sums = vertices.reduce(
		(sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]],
		[0, 0]
	);
	return [sums[0] / vertices.length, sums[1] / vertices.length];
}
