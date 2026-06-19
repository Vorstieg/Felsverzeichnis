/**
 * Simple integer-based ID generator for routes, outlines, and symbols
 * More compatible with older browsers than crypto.randomUUID()
 */

let routeIdCounter = 1;
let outlineIdCounter = 1;
let symbolIdCounter = 1;
let genericIdCounter = 1;

export function generateRouteId() {
	return `route-${routeIdCounter++}`;
}

export function generateOutlineId() {
	return `outline-${outlineIdCounter++}`;
}

export function generateSymbolId() {
	return `symbol-${symbolIdCounter++}`;
}

export function generateId(prefix = 'id') {
	return `${prefix}-${genericIdCounter++}`;
}

/**
 * Initialize counters from existing data to avoid collisions
 * @param {Object} topo - The topo object from userState
 */
export function initializeIdCounters(topo) {
	if (!topo) return;

	const findMaxId = (items, prefix) => {
		let max = 0;
		if (!items) return max;
		items.forEach((item) => {
			if (item.id && typeof item.id === 'string' && item.id.startsWith(prefix)) {
				const num = parseInt(item.id.replace(prefix, ''));
				if (!isNaN(num)) max = Math.max(max, num);
			}
		});
		return max;
	};

	routeIdCounter = findMaxId(topo.routes, 'route-') + 1;
	outlineIdCounter = findMaxId(topo.outlines, 'outline-') + 1;
	symbolIdCounter = findMaxId(topo.fixPoints, 'symbol-') + 1;

	// Also check pitches within routes for ID conflicts if we used them there
	topo.routes?.forEach((r) => {
		if (r.pitches) {
			const pitchMax = findMaxId(r.pitches, 'pitch-');
			genericIdCounter = Math.max(genericIdCounter, pitchMax + 1);
		}
	});
}

// Reset counters (useful for testing or when loading a new topo)
export function resetIdCounters() {
	routeIdCounter = 1;
	outlineIdCounter = 1;
	symbolIdCounter = 1;
	genericIdCounter = 1;
}
