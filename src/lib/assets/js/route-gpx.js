/** @param {string | number} value */
const escapeXml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(character) =>
			/** @type {Record<string, string>} */ ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&apos;'
			})[character]
	);

/** Return the geographic paths referenced by a route, in route order.
 * @param {import('@vorstieg/fels-types/types').FelsTopoDocument | null | undefined} topo
 * @param {import('$lib/types/application').SelectedClimbingLine | null | undefined} route
 * @returns {import('$lib/types/application').GpxTrack[]} */
export function getRouteTracks(topo, route) {
	const features = topo?.paths?.features;
	if (!features || !route?.pathRefs) return [];

	return route.pathRefs.flatMap((reference) => {
		const feature = features.find((item) => item.id === reference.pathId);
		if (!feature) return [];
		return [
			{
				name: reference.label || feature.properties?.name || reference.role || route.name,
				role: reference.role || feature.properties?.role || 'main',
				coordinates: feature.geometry.coordinates
			}
		];
	});
}

/** Convert a crag's separate access GeoJSON lines into GPX tracks.
 * @param {import('$lib/types/application').AccessCollection | null | undefined} access
 * @returns {import('$lib/types/application').GpxTrack[]} */
export function getAccessTracks(access) {
	return (access?.features ?? []).flatMap((feature) => {
		if (feature.properties.kind !== 'approach') return [];
		const lines =
			feature.geometry.type === 'MultiLineString'
				? feature.geometry.coordinates
				: feature.geometry.type === 'LineString'
					? [feature.geometry.coordinates]
					: [];
		return lines.map((coordinates) => ({
			name: feature.properties.name ?? 'Approach',
			role: 'approach',
			coordinates: /** @type {import('$lib/types/application').GpxTrack['coordinates']} */ (
				coordinates
			)
		}));
	});
}

/** Keep each leg separate while ordering a GPX as approach, climb, descent.
 * @param {import('$lib/types/application').GpxTrack[]} routeTracks
 * @param {import('$lib/types/application').GpxTrack[]} [fallbackAccessTracks] */
export function getTourTracks(
	routeTracks,
	fallbackAccessTracks = [],
	approachIndex = 0,
	descentIndex = 0
) {
	const approaches = routeTracks.filter((track) => track.role === 'approach');
	const availableApproaches = approaches.length ? approaches : fallbackAccessTracks;
	const climbs = routeTracks.filter(
		(track) => track.role !== 'approach' && track.role !== 'descent'
	);
	const descents = routeTracks.filter((track) => track.role === 'descent');
	return [availableApproaches[approachIndex], ...climbs, descents[descentIndex]].filter(
		(track) => track !== undefined
	);
}

/** Serialize a route's geographic paths as a GPX 1.1 track file. */
/** @param {Pick<import('@vorstieg/fels-types/types').Route, 'id' | 'name'>} route
 * @param {import('$lib/types/application').GpxTrack[]} tracks
 * @param {{startOfClimb?: string, endOfClimb?: string}} [waypointLabels] */
export function routeTracksToGpx(route, tracks, waypointLabels = {}) {
	const climbs = tracks.filter((track) => track.role !== 'approach' && track.role !== 'descent');
	const endPoint = climbs.at(-1)?.coordinates.at(-1);
	const waypoints = [
		climbs[0]?.coordinates?.[0]
			? { name: waypointLabels.startOfClimb || 'Start of climb', point: climbs[0].coordinates[0] }
			: null,
		endPoint ? { name: waypointLabels.endOfClimb || 'End of climb', point: endPoint } : null
	]
		.filter((waypoint) => waypoint !== null)
		.map(
			({ name, point }) =>
				`  <wpt lat="${point[1]}" lon="${point[0]}">${point[2] !== undefined ? `<ele>${point[2]}</ele>` : ''}<name>${escapeXml(name)}</name></wpt>`
		)
		.join('\n');
	const trackXml = tracks
		.map(
			({ name, role, coordinates }) =>
				`  <trk><name>${escapeXml(name || route.name || 'Track')}</name><type>${escapeXml(role || 'main')}</type><trkseg>\n${coordinates
					.map(
						(point) =>
							`    <trkpt lat="${point[1]}" lon="${point[0]}">${point[2] !== undefined ? `<ele>${point[2]}</ele>` : ''}</trkpt>`
					)
					.join('\n')}\n  </trkseg></trk>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Felsverzeichnis" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${escapeXml(route.name || 'Route')}</name></metadata>\n${waypoints ? `${waypoints}\n` : ''}${trackXml}\n</gpx>\n`;
}

/** Trigger a browser download for the selected route. */
/** @param {Pick<import('@vorstieg/fels-types/types').Route, 'id' | 'name'>} route
 * @param {import('$lib/types/application').GpxTrack[]} tracks
 * @param {{startOfClimb?: string, endOfClimb?: string}} [waypointLabels] */
export function downloadRouteGpx(route, tracks, suffix = '', waypointLabels = {}) {
	if (!tracks?.length) return;
	const gpx = routeTracksToGpx(route, tracks, waypointLabels);
	const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = `${String(route.id).replace(/[^a-zA-Z0-9_-]+/g, '-')}${suffix}.gpx`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
