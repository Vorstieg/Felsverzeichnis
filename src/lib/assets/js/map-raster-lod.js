const DEG_TO_RAD = Math.PI / 180;
const MIN_RATIO = 1e-6;

export function slowRasterTileDecay(
	map,
	sourceId = 'worldImagery',
	nearTileDecayFactor = 0.15
) {
	const source = map.getSource(sourceId);
	if (!source) return;

	source.calculateTileZoom = (
		requestedCenterZoom,
		distanceToTile2D,
		distanceToTileZ,
		distanceToCenter3D,
		cameraVerticalFOV
	) => {
		const distanceToTile3D = Math.hypot(distanceToTile2D, distanceToTileZ);
		const fieldOfViewCorrection = Math.max(
			0.5,
			Math.cos(cameraVerticalFOV * DEG_TO_RAD / 2)
		);
		const distanceRatio = distanceToCenter3D
			/ Math.max(distanceToTile3D * fieldOfViewCorrection, MIN_RATIO);
		const tilePitch = Math.atan(distanceToTile2D / distanceToTileZ);
		const pitchRatio = Math.max(Math.cos(tilePitch), MIN_RATIO);
		const defaultZoomOffset = Math.log2(Math.max(distanceRatio, MIN_RATIO))
			+ Math.log2(pitchRatio) / 2;

		if (defaultZoomOffset >= -1) {
			return requestedCenterZoom + defaultZoomOffset * nearTileDecayFactor;
		}

		return requestedCenterZoom
			- nearTileDecayFactor
			+ (defaultZoomOffset + 1);
	};
}
