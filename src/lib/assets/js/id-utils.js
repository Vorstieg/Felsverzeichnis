/**
 * Simple integer-based ID generator for routes, outlines, and symbols
 * More compatible with older browsers than crypto.randomUUID()
 */

let routeIdCounter = 1;
let outlineIdCounter = 1;
let symbolIdCounter = 1;

export function generateRouteId() {
    return `route-${routeIdCounter++}`;
}

export function generateOutlineId() {
    return `outline-${outlineIdCounter++}`;
}

export function generateSymbolId() {
    return `symbol-${symbolIdCounter++}`;
}

// Reset counters (useful for testing or when loading a new topo)
export function resetIdCounters() {
    routeIdCounter = 1;
    outlineIdCounter = 1;
    symbolIdCounter = 1;
}
