const escapeXml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(character) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]
	);

const isValidLine = (coordinates) =>
	Array.isArray(coordinates) &&
	coordinates.length >= 2 &&
	coordinates.every(
		(point) =>
			Array.isArray(point) &&
			Number.isFinite(point[0]) &&
			Number.isFinite(point[1]) &&
			Math.abs(point[0]) <= 180 &&
			Math.abs(point[1]) <= 90
	);

/** Return the geographic paths referenced by a route, in route order. */
export function getRouteTracks(topo, route) {
	const features = topo?.paths?.features;
	if (!Array.isArray(features) || !Array.isArray(route?.pathRefs)) return [];

	return route.pathRefs.flatMap((reference) => {
		const feature = features.find((item) => String(item.id) === String(reference.pathId));
		const coordinates = feature?.geometry?.coordinates;
		if (feature?.geometry?.type !== 'LineString' || !isValidLine(coordinates)) return [];
		return [
			{
				name: reference.label || feature.properties?.name || reference.role || route.name,
				role: reference.role || feature.properties?.role || 'main',
				coordinates
			}
		];
	});
}

/** Convert a crag's separate access GeoJSON lines into GPX tracks. */
export function getAccessTracks(access) {
	return (access?.features || []).flatMap((feature) => {
		if (feature?.properties?.kind !== 'approach') return [];
		const lines =
			feature.geometry?.type === 'MultiLineString'
				? feature.geometry.coordinates
				: feature.geometry?.type === 'LineString'
					? [feature.geometry.coordinates]
					: [];
		return lines.filter(isValidLine).map((coordinates) => ({
			name: feature.properties?.name || 'Approach',
			role: 'approach',
			coordinates
		}));
	});
}

/** Keep each leg separate while ordering a GPX as approach, climb, descent. */
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
	return [
		availableApproaches[approachIndex] || availableApproaches[0],
		...climbs,
		descents[descentIndex] || descents[0]
	].filter(Boolean);
}

/** Serialize a route's geographic paths as a GPX 1.1 track file. */
export function routeTracksToGpx(route, tracks) {
	const trackXml = tracks
		.map(
			({ name, role, coordinates }) =>
				`  <trk><name>${escapeXml(name || route.name || 'Track')}</name><type>${escapeXml(role || 'main')}</type><trkseg>\n${coordinates
					.map(
						(point) =>
							`    <trkpt lat="${point[1]}" lon="${point[0]}">${Number.isFinite(point[2]) ? `<ele>${point[2]}</ele>` : ''}</trkpt>`
					)
					.join('\n')}\n  </trkseg></trk>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Felsverzeichnis" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${escapeXml(route.name || 'Route')}</name></metadata>\n${trackXml}\n</gpx>\n`;
}

/** Trigger a browser download for the selected route. */
export function downloadRouteGpx(route, tracks, suffix = '') {
	if (!tracks?.length) return;
	const gpx = routeTracksToGpx(route, tracks);
	const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = `${String(route.id || route.name || 'route').replace(/[^a-zA-Z0-9_-]+/g, '-')}${suffix}.gpx`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
