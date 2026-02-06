import { Vector3 } from 'three';
import { userState } from '$lib/state/editor.svelte.js';
import { generateId } from './id-utils.js';

export const availableTopoTags = [
    'Kinderfreundlich', 'Regensicher', 'Kurzer Zustieg', 'Alpin',
    'Brüchig', 'Beliebt', 'Morgensonne', 'Abendsonne', 'Schattig'
];

export const availableRouteTags = [
    'Technisch', 'Kraft', 'Ausdauer', 'Leisten', 'Löcher', 'Riss',
    'Platte', 'Überhang', 'Weite Haken', 'Abgespeckt', 'Klassiker', 'Boulder-Start'
];

export function convertRouteType(route, newType) {
    if (newType === 'multi-pitch' && route.type !== 'multi-pitch') {
        // Convert to multi-pitch: Move current properties to first pitch
        route.pitches = [{
            id: generateId('pitch'),
            pitchNumber: 1,
            grade: route.grade,
            _gradeScale: route._gradeScale || 'french',
            length: route.length,
            description: route.description,
            points: route.points || [],
            type: 'pitch'
        }];
        // Clear root properties that are moved
        route.length = 0;
        route.points = [];
    } else if (newType !== 'multi-pitch' && route.type === 'multi-pitch') {
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
    route.type = newType;
}

export function calculateRouteLength(route) {
    if (!route.points || route.points.length < 2) return 0;
    let len = 0;
    for (let i = 0; i < route.points.length - 1; i++) {
        const p1 = new Vector3(...route.points[i]);
        const p2 = new Vector3(...route.points[i + 1]);
        len += p1.distanceTo(p2);
    }
    return parseFloat((len * (userState.topo.scale || 1)).toFixed(1));
}

export function calculateBoltAmount(route) {
    if (!route.fixPoints) return 0;
    let count = 0;
    route.fixPoints.forEach(id => {
        const fp = userState.topo.fixPoints.find(p => p.id === id);
        if (fp && fp.type === 'bolt') count++;
    });
    return count;
}

export const topoSymbols = [
    // Fixpoints (Small)
    { id: 'bolt', name: 'Bolt', icon: '/icons/topo-symbols/bolt.svg', type: 'fixpoint', width: 16, height: 16 },
    { id: 'piton', name: 'Piton', icon: '/icons/topo-symbols/piton.svg', type: 'fixpoint', width: 16, height: 16 },
    { id: 'hourglass', name: 'Hourglass', icon: '/icons/topo-symbols/hourglass.svg', type: 'fixpoint', width: 16, height: 16 },
    { id: 'belay', name: 'Belay', icon: '/icons/topo-symbols/belay.svg', type: 'fixpoint', width: 16, height: 16 },
    { id: 'abseil', name: 'Abseil', icon: '/icons/topo-symbols/abseil.svg', type: 'fixpoint', width: 16, height: 16 },

    // Features (Large)
    { id: 'crux', name: 'Crux', icon: '/icons/topo-symbols/crux.svg', type: 'feature', width: 32, height: 32 },
    { id: 'crack', name: 'Crack', icon: '/icons/topo-symbols/crack.svg', type: 'feature', width: 32, height: 32 },
    { id: 'chimney', name: 'Chimney', icon: '/icons/topo-symbols/chimney.svg', type: 'feature', width: 32, height: 32 },
    { id: 'slab', name: 'Slab', icon: '/icons/topo-symbols/slab.svg', type: 'feature', width: 32, height: 32 },
    { id: 'overhang', name: 'Overhang', icon: '/icons/topo-symbols/overhang.svg', type: 'feature', width: 32, height: 32 },
    { id: 'rubble', name: 'Rubble', icon: '/icons/topo-symbols/rubble.svg', type: 'feature', width: 32, height: 32 },
    { id: 'tree', name: 'Tree', icon: '/icons/topo-symbols/tree.svg', type: 'feature', width: 32, height: 32 }
];
