import SunCalc from 'suncalc';
import type { FelsTopoDocument, Point3D, Route } from '@vorstieg/fels-types/types';
import { colors as appColors } from '$lib/colors.js';

// Prefer 3D orientations; an explicit wall azimuth is only a fallback.
function calculateWallHeading(topo: FelsTopoDocument, route: Route | null) {
	const getOrientation = (item: Route): Point3D | null => {
		const vector = item.orientation3D;
		return vector && vector.every(Number.isFinite) && (vector[0] !== 0 || vector[2] !== 0)
			? vector
			: null;
	};
	const orientation =
		(route ? getOrientation(route) : null) ??
		topo.routes.reduce<Point3D>(
			(sum, item) => {
				const vector = getOrientation(item);
				return vector ? [sum[0] + vector[0], sum[1] + vector[1], sum[2] + vector[2]] : sum;
			},
			[0, 0, 0]
		);
	if (orientation && (orientation[0] !== 0 || orientation[2] !== 0)) {
		return ((Math.atan2(orientation[0], -orientation[2]) * 180) / Math.PI + 360) % 360;
	}
	return typeof topo.wallAzimuth === 'number' && Number.isFinite(topo.wallAzimuth)
		? ((topo.wallAzimuth % 360) + 360) % 360
		: null;
}

export function calculateWallDirection(topo: FelsTopoDocument, route: Route | null = null) {
	const heading = calculateWallHeading(topo, route);
	if (heading === null) return 'Unknown';

	const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	const dirIndex = Math.round(heading / 45) % 8;
	return dirs[dirIndex];
}

export function calculateSunInfo(topo: FelsTopoDocument, route: Route | null = null) {
	if (!topo.coordinates) {
		return { hours: 'no_geodata', chartData: null };
	}

	const [lng, lat] = topo.coordinates;
	const heading = calculateWallHeading(topo, route);
	if (heading === null) {
		return { hours: 'Unknown', chartData: null };
	}
	const targetAzimuthRad = (heading - 180) * (Math.PI / 180);

	const now = new Date();
	const startOfDay = new Date(now.setHours(6, 0, 0, 0));
	const endOfDay = new Date(now.setHours(21, 0, 0, 0));
	const limit = Math.PI / 2;

	let sunStart = null;
	let sunEnd = null;

	// Chart Data Containers
	const labels: string[] = [];
	const altitudes: number[] = [];
	const colors: string[] = [];
	const conditions: ('sun.sunny' | 'sun.shadow' | 'sun.low_sun')[] = [];

	// Hourly scan for chart
	for (let h = 6; h <= 21; h++) {
		const date = new Date(now);
		date.setHours(h, 0, 0, 0);
		const sunPos = SunCalc.getPosition(date, lat, lng);

		let diff = Math.abs(sunPos.azimuth - targetAzimuthRad);
		if (diff > Math.PI) diff = 2 * Math.PI - diff;

		const altDeg = sunPos.altitude * (180 / Math.PI);
		const isUp = altDeg > 5; // Terrain horizon approx
		const isFacing = diff < limit;
		const isInSun = isUp && isFacing;

		labels.push(`${h}`);
		altitudes.push(Math.max(0, altDeg));

		if (isInSun) {
			colors.push(appColors.chart.sunny);
			conditions.push('sun.sunny');
		} else if (isUp) {
			colors.push(appColors.chart.shade);
			conditions.push('sun.shadow');
		} else {
			colors.push(appColors.chart.lowSun);
			conditions.push('sun.low_sun');
		}
	}

	// Detailed scan for text time (15 min)
	for (let t = startOfDay.getTime(); t <= endOfDay.getTime(); t += 15 * 60 * 1000) {
		const date = new Date(t);
		const sunPos = SunCalc.getPosition(date, lat, lng);
		let diff = Math.abs(sunPos.azimuth - targetAzimuthRad);
		if (diff > Math.PI) diff = 2 * Math.PI - diff;

		if (diff < limit && sunPos.altitude > 0.1) {
			if (!sunStart) sunStart = date;
			sunEnd = date;
		}
	}

	let hoursStr = 'shade_all_day';
	if (sunStart && sunEnd) {
		const format = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		hoursStr = `${format(sunStart)} - ${format(sunEnd)}`;
	}

	return {
		hours: hoursStr,
		chartData: { labels, altitudes, colors, conditions }
	};
}

export function calculateSunPositionVector(
	date: Date,
	lat: number,
	lng: number
): [number, number, number] {
	const sunPos = SunCalc.getPosition(date, lat, lng);

	// SunCalc: Azimuth 0 = South (+Z), increasing values -> West (-X)
	// Three.js (assumed): Y=Up, Z=South, X=East
	const r = 15;
	const phi = Math.PI / 2 - sunPos.altitude; // Zenith angle
	const theta = sunPos.azimuth;

	return [
		-r * Math.sin(phi) * Math.sin(theta),
		r * Math.cos(phi),
		r * Math.sin(phi) * Math.cos(theta)
	];
}

export function calculateBestSeason(topo: FelsTopoDocument, route: Route | null = null) {
	if (!topo.coordinates) {
		return null;
	}

	const [lng, lat] = topo.coordinates;
	const heading = calculateWallHeading(topo, route);
	if (heading === null) {
		return null;
	}
	const targetAzimuthRad = (heading - 180) * (Math.PI / 180);
	// Yearly Temperature Model Approximation based on Latitude and Altitude

	// Mean Temp: 30 - 0.5 * |lat|
	const absLat = Math.abs(lat);

	// Model tuned for Daytime Highs (Climbing relevant)
	let yearlyMean = 48 - 0.7 * absLat;

	// Altitude Lapse Rate: -6.5 degrees per 1000m
	yearlyMean -= (topo.coordinates[2] / 1000) * 6.5;

	// Amplitude (Seasonality strength)
	const yearlyAmp = 5 + 0.2 * absLat;

	const limit = Math.PI / 2; // +/- 90 degrees for direct sun exposure

	const monthlyTemps = [];
	const feelsLikeTemps = [];
	const labels = [];

	for (let m = 0; m < 12; m++) {
		// Southern Hemisphere months are offset by 6
		let monthOffset = m;
		if (lat < 0) monthOffset = (m + 6) % 12;

		// Cosine model: Min Temp in Jan (monthOffset=0), Max Temp in July (monthOffset=6)
		const baseTemp = yearlyMean - yearlyAmp * Math.cos((monthOffset * Math.PI) / 6);

		// Calculate sun exposure for mid-day (13:00) of the month
		const date = new Date(new Date().getFullYear(), m, 15, 13, 0, 0);
		const sunPos = SunCalc.getPosition(date, lat, lng);

		let diff = Math.abs(sunPos.azimuth - targetAzimuthRad);
		if (diff > Math.PI) diff = 2 * Math.PI - diff;

		const altDeg = sunPos.altitude * (180 / Math.PI);
		const isFacing = diff < limit; // Check if wall is facing the sun

		let sunBoost = 0;
		// Apply sun boost if wall is facing the sun and sun is above horizon
		if (isFacing && altDeg > 10) {
			// Sun can add 10-15 degrees 'feels like' depending on incidence angle
			const incidence = Math.cos(sunPos.altitude) * Math.cos(diff);
			sunBoost = 15 * Math.max(0, incidence); // Max 15 degree boost
		}

		const feelsLike = baseTemp + sunBoost;

		monthlyTemps.push(baseTemp);
		feelsLikeTemps.push(feelsLike);
		labels.push(m.toString());
	}

	return {
		labels,
		baseTemps: monthlyTemps,
		feelsLikeTemps: feelsLikeTemps,
		lat
	};
}
