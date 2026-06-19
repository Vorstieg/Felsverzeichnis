import { Vector3 } from 'three';
import { generateId } from './id-utils.js';

export const availableTopoTags = [
	'Kinderfreundlich',
	'Regensicher',
	'Kurzer Zustieg',
	'Alpin',
	'Brüchig',
	'Beliebt',
	'Morgensonne',
	'Abendsonne',
	'Schattig'
];

export const availableRouteTags = [
	'Technisch',
	'Kraft',
	'Ausdauer',
	'Leisten',
	'Löcher',
	'Riss',
	'Platte',
	'Überhang',
	'Weite Haken',
	'Abgespeckt',
	'Klassiker',
	'Boulder-Start'
];

export function convertRouteType(route, newType) {
	const isMultiPitch = (type) =>
		Array.isArray(type) ? type.includes('multi-pitch') : type === 'multi-pitch';
	const wasMultiPitch = isMultiPitch(route.type);
	const willBeMultiPitch = newType === 'multi-pitch';

	if (willBeMultiPitch && !wasMultiPitch) {
		// Convert to multi-pitch: Move current properties to first pitch
		route.pitches = [
			{
				id: generateId('pitch'),
				pitchNumber: 1,
				grade: route.grade,
				_gradeScale: route._gradeScale || 'french',
				length: route.length,
				description: route.description,
				points: route.points || [],
				type: 'pitch'
			}
		];
		// Clear root properties that are moved
		route.length = 0;
		route.points = [];
	} else if (!willBeMultiPitch && wasMultiPitch) {
		// Convert from multi-pitch: Take first pitch properties back to root
		if (route.pitches && route.pitches.length > 0) {
			const first = route.pitches[0];
			route.grade = first.grade;
			route._gradeScale = first._gradeScale;
			route.length = first.length;
			route.description = first.description;
			route.points = first.points;
		}
		delete route.pitches;
	}

	// For now, if called from a simple select, we set it as a single-element array or update if it was an array
	if (Array.isArray(route.type)) {
		if (willBeMultiPitch && !route.type.includes('multi-pitch')) {
			route.type.push('multi-pitch');
		} else if (!willBeMultiPitch && route.type.includes('multi-pitch')) {
			route.type = route.type.filter((t) => t !== 'multi-pitch');
			if (route.type.length === 0) route.type = [newType];
		} else {
			// Just replacing the first one or similar?
			// Better to keep it simple for now if it's a simple type change
			route.type = [newType];
		}
	} else {
		route.type = [newType];
	}
}

export function calculateRouteLength(route, scale = 1) {
	if (!route.points || route.points.length < 2) return 0;
	let len = 0;
	for (let i = 0; i < route.points.length - 1; i++) {
		const p1 = new Vector3(...route.points[i]);
		const p2 = new Vector3(...route.points[i + 1]);
		len += p1.distanceTo(p2);
	}
	return parseFloat((len * scale).toFixed(1));
}

export function calculateBoltAmount(route, fixPoints = []) {
	if (!route.fixPoints || !fixPoints) return 0;
	let count = 0;
	route.fixPoints.forEach((id) => {
		const fp = fixPoints.find((p) => p.id === id);
		if (fp && fp.type === 'bolt') count++;
	});
	return count;
}

export const topoSymbols = [
	// Fixpoints (Small)
	{
		id: 'bolt',
		name: 'Bolt',
		icon: '/icons/topo-symbols/bolt.svg',
		type: 'fixpoint',
		width: 16,
		height: 16
	},
	{
		id: 'piton',
		name: 'Piton',
		icon: '/icons/topo-symbols/piton.svg',
		type: 'fixpoint',
		width: 16,
		height: 16
	},
	{
		id: 'hourglass',
		name: 'Hourglass',
		icon: '/icons/topo-symbols/hourglass.svg',
		type: 'fixpoint',
		width: 16,
		height: 16
	},
	{
		id: 'belay',
		name: 'Belay',
		icon: '/icons/topo-symbols/belay.svg',
		type: 'fixpoint',
		width: 16,
		height: 16
	},
	{
		id: 'abseil',
		name: 'Abseil',
		icon: '/icons/topo-symbols/abseil.svg',
		type: 'fixpoint',
		width: 16,
		height: 16
	},

    // Features (Large)
    { id: 'band', name: 'Band', icon: '/icons/topo-symbols/band.svg', type: 'feature', width: 32, height: 32 },
    { id: 'bivouac', name: 'Bivouac', icon: '/icons/topo-symbols/bivouac.svg', type: 'feature', width: 32, height: 32 },
    { id: 'cave', name: 'Cave', icon: '/icons/topo-symbols/cave.svg', type: 'feature', width: 32, height: 32 },
    { id: 'chimney', name: 'Chimney', icon: '/icons/topo-symbols/chimney.svg', type: 'feature', width: 32, height: 32 },
    { id: 'chockstone', name: 'Chockstone', icon: '/icons/topo-symbols/chockstone.svg', type: 'feature', width: 32, height: 32 },
    { id: 'corner', name: 'Corner', icon: '/icons/topo-symbols/corner.svg', type: 'feature', width: 32, height: 32 },
    { id: 'cornice', name: 'Cornice', icon: '/icons/topo-symbols/cornice.svg', type: 'feature', width: 32, height: 32 },
    { id: 'crack', name: 'Crack', icon: '/icons/topo-symbols/crack.svg', type: 'feature', width: 32, height: 32 },
    { id: 'crux', name: 'Crux', icon: '/icons/topo-symbols/crux.svg', type: 'feature', width: 32, height: 32 },
    { id: 'dwarf-pine', name: 'Dwarf Pine', icon: '/icons/topo-symbols/dwarf-pine.svg', type: 'feature', width: 32, height: 32 },
    { id: 'fixed-cable', name: 'Fixed Cable', icon: '/icons/topo-symbols/fixed-cable.svg', type: 'feature', width: 32, height: 32 },
    { id: 'grass', name: 'Grass', icon: '/icons/topo-symbols/grass.svg', type: 'feature', width: 32, height: 32 },
    { id: 'gully', name: 'Gully', icon: '/icons/topo-symbols/gully.svg', type: 'feature', width: 32, height: 32 },
    { id: 'hidden-route', name: 'Hidden Route', icon: '/icons/topo-symbols/hidden-route.svg', type: 'feature', width: 32, height: 32 },
    { id: 'leaf-tree', name: 'Leaf Tree', icon: '/icons/topo-symbols/leaf-tree.svg', type: 'feature', width: 32, height: 32 },
    { id: 'ledge', name: 'Ledge', icon: '/icons/topo-symbols/ledge.svg', type: 'feature', width: 32, height: 32 },
    { id: 'needle-tree', name: 'Needle Tree', icon: '/icons/topo-symbols/needle-tree.svg', type: 'feature', width: 32, height: 32 },
    { id: 'overhang', name: 'Overhang', icon: '/icons/topo-symbols/overhang.svg', type: 'feature', width: 32, height: 32 },
    { id: 'ramp', name: 'Ramp', icon: '/icons/topo-symbols/ramp.svg', type: 'feature', width: 32, height: 32 },
    { id: 'roof', name: 'Roof', icon: '/icons/topo-symbols/roof.svg', type: 'feature', width: 32, height: 32 },
    { id: 'rubble', name: 'Rubble', icon: '/icons/topo-symbols/rubble.svg', type: 'feature', width: 32, height: 32 },
    { id: 'shoulder', name: 'Shoulder', icon: '/icons/topo-symbols/shoulder.svg', type: 'feature', width: 32, height: 32 },
    { id: 'slab', name: 'Slab', icon: '/icons/topo-symbols/slab.svg', type: 'feature', width: 32, height: 32 },
    { id: 'snow', name: 'Snow', icon: '/icons/topo-symbols/snow.svg', type: 'feature', width: 32, height: 32 },
    { id: 'tree', name: 'Tree', icon: '/icons/topo-symbols/tree.svg', type: 'feature', width: 32, height: 32 },
    { id: 'variant', name: 'Variant', icon: '/icons/topo-symbols/variant.svg', type: 'feature', width: 32, height: 32 },
    { id: 'visible-route', name: 'Visible Route', icon: '/icons/topo-symbols/visible-route.svg', type: 'feature', width: 32, height: 32 },
    { id: 'water-streak', name: 'Water Streak', icon: '/icons/topo-symbols/water-streak.svg', type: 'feature', width: 32, height: 32 }
];
