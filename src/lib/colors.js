/**
 * Application palette.
 *
 * Keep semantic/domain colors here so map layers, topo renderers and charts
 * stay visually consistent. Tailwind utility colors remain available for
 * one-off layout states; reusable visual meanings belong in this file.
 */
export const colors = Object.freeze({
	brand: Object.freeze({
		blue: '#3b82f6',
		green: '#10b981',
		orange: '#f97316',
		violet: '#8b5cf6',
		pink: '#ec4899'
	}),
	text: Object.freeze({
		ink: '#2f3948',
		black: '#152030',
		white: '#ffffff',
		muted: '#6b7280'
	}),
	ui: Object.freeze({
		background: '#faf9f8',
		grid: '#e5e7eb',
		border: '#f3f4f6',
		overlay: '#000000cc',
		transparent: 'transparent'
	}),
	routeTypes: Object.freeze({
		'sports-climbing': '#3b82f6',
		'multi-pitch': '#10b981',
		bouldering: '#f97316',
		trad: '#eab308',
		'alpine-tour': '#8b5cf6',
		'via-ferrata': '#ec4899'
	}),
	gpxRoles: Object.freeze({
		main: '#8b5cf6',
		approach: '#10b981',
		descent: '#f97316',
		variant: '#cccccc'
	}),
	topoPaths: Object.freeze({
		main: '#3b82f6',
		approach: '#f97316',
		descent: '#f97316',
		variant: '#cccccc',
		fixedRope: '#1d70b8'
	}),
	topo: Object.freeze({
		route: '#ffdf12',
		routeHover: '#ff0000',
		routeSelected: '#3b82f6',
		gradeEasy: '#4ade80',
		gradeMedium: '#facc15',
		gradeHard: '#f97316',
		gradeVeryHard: '#d946ef',
		gradeUnknown: '#cccccc'
	}),
	map: Object.freeze({
		train: '#8b5cf6',
		bus: '#6366f1',
		parking: '#6b7280',
		sectorText: '#000000',
		sectorTextHalo: '#ffffff'
	}),
	chart: Object.freeze({
		sunny: '#fbbf24',
		shade: '#9ca3af',
		lowSun: '#e5e7eb',
		grid: '#f3f4f6',
		temperature: '#fbbf24',
		good: '#10b981',
		warning: '#f59e0b',
		danger: '#ef4444',
		steep: '#ef4444',
		moderate: '#facc15',
		gentle: '#2dd4bf',
		gradeGreen: '#22c55e',
		gradePurple: '#9333ea'
	})
});

export const routeTypeColors = colors.routeTypes;
export const gpxRoleColors = colors.gpxRoles;
