export const userState = $state({
	topo: {
		name: '',
		description: '',
		rock: 'granite',
		tags: [],
		routes: [],
		fixPoints: [],          // Unified markers: [{id, type, position: [x,y,z], position2D: [x,y], rotation2D, scale2D}]
		outlines: [],           // Rock outlines: [{id, points2D: [[x,y], ...]}]
		date: '',
		updated: '',
		modelOffset: [0, 0, 0],
		coordinates: [0, 0],
		wallAzimuth: 0,
		altitude: 0,
		scale: 1,
		// 2D TOPO Editor fields
		image2D: null,          // Base64 data URL or external URL, null for blank canvas
		imageAspectRatio: 1.5,  // Width/Height ratio for responsive rendering
		editorMode: '3d',       // '2d' | '3d' - which editor is active
		selectedRouteId: null,  // ID of the route currently selected for editing
		selectedOutlineId: null // ID of the rock outline currently selected for editing
	},
	// UI State for the editor
	ui: {
		selectedFixpointId: null
	}
});
