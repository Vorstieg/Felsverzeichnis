import { userState } from '$lib/state/editor.svelte.js';

export class SymbolTool {
    id = 'symbol';
    // No state needed for symbol tool currently as it places on click

    constructor({ saveHistory } = {}) {
        this.saveHistory = saveHistory || (() => { });
    }

    selectedType = 'bolt';

    onMouseDown(event, point) {
        const symbolId = crypto.randomUUID();
        userState.topo.fixPoints.push({
            id: symbolId,
            type: this.selectedType,
            position2D: [point.x, point.y],
            rotation2D: 0,
            scale2D: 1
        });
        this.saveHistory();
    }

    onMouseMove(event, point) { }
    onMouseUp(event, point) { }
    onKeyDown(event) { }
    onActivate() { }
    onDeactivate() { }
}
