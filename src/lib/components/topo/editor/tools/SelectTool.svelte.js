import { userState } from '$lib/state/editor.svelte.js';

export class SelectTool {
    id = 'select';
    constructor({ saveHistory } = {}) {
        this.saveHistory = saveHistory || (() => { });
    }

    onMouseDown(event, point) {
        // Select tool just delegates to generic hit testing or is handled by Topo2DEditor's global click handlers 
        // for selecting routes/outlines which I kept in Topo2DEditor helpers (handleRouteClick etc).
        // But clicking empty space deselects.
        // Topo2DEditor's handleSVGClick delegated to tool.
        // So I should handle deselection here?
        // Or Topo2DEditor handled it BEFORE tool?
        // My Topo2DEditor refactor: "1. Handle Deselection first ... 2. Handle Tool Actions -> currentTool.onMouseDown"
        // So deselection of symbols/routes is handled in Topo2DEditor before calling this.
    }

    onMouseMove(event, point) { }
    onMouseUp(event, point) { }
    onKeyDown(event) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (userState.ui.selectedFixpointId) {
                const idToDelete = userState.ui.selectedFixpointId;
                // Remove from global fixpoints
                userState.topo.fixPoints = userState.topo.fixPoints.filter(p => p.id !== idToDelete);

                // Remove references from routes
                userState.topo.routes.forEach(route => {
                    if (route.fixPoints) {
                        route.fixPoints = route.fixPoints.filter(id => id !== idToDelete);
                    }
                    if (route.pitches) {
                        route.pitches.forEach(pitch => {
                            if (pitch.startNodeId === idToDelete) pitch.startNodeId = null; // Potential validity issue
                            if (pitch.endNodeId === idToDelete) pitch.endNodeId = null;
                        });
                    }
                });

                userState.ui.selectedFixpointId = null;
                this.saveHistory();
            }
        }
    }
    onActivate() { }
    onDeactivate() { }
}
