export function normalizePlaceFeature(feature) {
	const properties = feature?.properties || {};
	const rawType = properties.type;
	const type = Array.isArray(rawType)
		? rawType[0] || null
		: typeof rawType === 'string'
			? rawType.split(',')[0].trim() || null
			: rawType;

	return {
		...feature,
		properties: { ...properties, type }
	};
}

export function createPlacesData(locations = []) {
	return {
		type: 'FeatureCollection',
		features: Array.isArray(locations) ? locations.map(normalizePlaceFeature) : []
	};
}

export function createTopoPathsData(topoPaths = []) {
	return {
		type: 'FeatureCollection',
		features: Array.isArray(topoPaths)
			? topoPaths.filter(
					(feature) =>
						feature?.type === 'Feature' &&
						feature.geometry?.type === 'LineString' &&
						Array.isArray(feature.geometry.coordinates) &&
						feature.geometry.coordinates.length >= 2
				)
			: []
	};
}

export function getMapPadding(viewport = {}) {
	const { width = 0, height = 0 } = viewport;
	if (width >= 1024) return { top: 0, bottom: 0, left: 0, right: 680 };
	if (width > 640) return { top: 0, bottom: 0, left: 0, right: 440 };
	return { top: 0, bottom: height * 0.5, left: 0, right: 0 };
}

export function selectionExpression(selectedPath) {
	if (!selectedPath) return null;
	let decodedPath = selectedPath;
	try {
		decodedPath = decodeURIComponent(selectedPath);
	} catch {
		// Keep malformed URL paths usable as literal paths.
	}
	return ['==', ['index-of', ['concat', ['get', 'path'], '/'], decodedPath + '/'], 0];
}
