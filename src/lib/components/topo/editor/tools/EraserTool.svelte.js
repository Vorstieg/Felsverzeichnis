import { userState } from '$lib/state/editor.svelte.js';

export class EraserTool {
    id = 'eraser';

    constructor({ saveHistory } = {}) {
        this.saveHistory = saveHistory || (() => { });
    }

    onMouseDown(event, point) {
        // Eraser logic
        const clickedSymbol = userState.topo.fixPoints.find(s => {
            if (!s.position2D) return false;
            const dx = Math.abs(s.position2D[0] - point.x);
            const dy = Math.abs(s.position2D[1] - point.y);
            return dx < 0.02 && dy < 0.02; // Tolerance
        });
        if (clickedSymbol) {
            userState.topo.fixPoints = userState.topo.fixPoints.filter(s => s.id !== clickedSymbol.id);
            this.saveHistory();
        }
        // Eraser also deletes points via handlePointMouseDown in Topo2DEditor (which I preserved).
        // If I want to move that here, I'd need to handle point hit testing.
        // For now, Topo2DEditor logic handles point deletion.
    }

    onMouseMove(event, point) { }
    onMouseUp(event, point) { }
    onKeyDown(event) { }
    onActivate() { }
    onDeactivate() { }
}
