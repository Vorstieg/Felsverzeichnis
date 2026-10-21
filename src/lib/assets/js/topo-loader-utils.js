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

/** Find the parent route for a route, pitch, or variant ID.
 * @param {import("@vorstieg/fels-types/types").Route[] | null | undefined} routes
 * @param {string | number | null | undefined} childId
 * @returns {import("@vorstieg/fels-types/types").Route | null} */
export function getParentRoute(routes, childId) {
	if (!routes || childId == null) return null;
	const id = String(childId);
	for (const parent of routes) {
		if (String(parent.id) === id) return parent;
		if (parent.pitches && parent.pitches.some((p) => String(p.id) === id)) return parent;
		if (parent.variants && parent.variants.some((v) => String(v.id) === id)) return parent;
	}
	return null;
}

/**
 * Returns the explicit pitch name if present, or a localized fallback like "Pitch 1" / "Seillänge 1".
 * @param {Partial<import('@vorstieg/fels-types/types').Pitch | import('@vorstieg/fels-types/types').Route> | null | undefined} pitch
 * @param {number} [index] - 0-based pitch index
 * @param {((key: string, options?: Record<string, unknown>) => string) | null | undefined} [t] - translation function
 * @returns {string}
 */
export function getPitchDisplayName(pitch, index = 0, t) {
	if (pitch && typeof pitch.name === 'string' && pitch.name.trim() !== '') {
		return pitch.name;
	}
	const number =
		pitch && typeof pitch === 'object' && 'pitchNumber' in pitch && pitch.pitchNumber != null
			? Number(pitch.pitchNumber)
			: index + 1;
	if (typeof t === 'function') {
		const translated = t('topo.pitch_numbered', { values: { number } });
		if (translated && translated !== 'topo.pitch_numbered') {
			return translated;
		}
		const pitchWord = t('topo.pitch', { default: 'Pitch' });
		if (pitchWord && pitchWord !== 'topo.pitch') {
			return `${pitchWord} ${number}`;
		}
	}
	return `Pitch ${number}`;
}

/**
 * Resolves the display name for a route or pitch.
 * If the route is a pitch without an explicit name, resolves its fallback using its index in the parent route.
 * @param {import('@vorstieg/fels-types/types').Route | null | undefined} route
 * @param {import('@vorstieg/fels-types/types').Route | null | undefined} parentRoute
 * @param {((key: string, options?: Record<string, unknown>) => string) | null | undefined} [t]
 * @returns {string}
 */
export function getRouteDisplayName(route, parentRoute, t) {
	if (!route) return '';
	if (typeof route.name === 'string' && route.name.trim() !== '') {
		return route.name;
	}
	if (parentRoute?.pitches) {
		const index = parentRoute.pitches.findIndex((p) => String(p.id) === String(route.id));
		if (index !== -1) {
			return getPitchDisplayName(route, index, t);
		}
	}
	return String(route.name || route.id || '');
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
