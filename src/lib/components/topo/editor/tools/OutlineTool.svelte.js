import { userState } from '$lib/state/editor.svelte.js';

export class OutlineTool {
    id = 'outline';
    currentPoints = $state([]);

    constructor({ saveHistory } = {}) {
        this.saveHistory = saveHistory || (() => { });
    }

    onMouseDown(event, point) {
        event.stopPropagation();

        // If an outline is selected, append to it
        if (userState.ui.selectedOutlineId) {
            const outline = userState.topo.outlines.find(o => o.id === userState.ui.selectedOutlineId);
            if (outline) {
                outline.points2D = [...(outline.points2D || []), [point.x, point.y]];
                this.saveHistory();
            }
        } else {
            // New outline
            this.currentPoints = [...this.currentPoints, [point.x, point.y]];
        }
    }

    onMouseMove(event, point) { }

    onMouseUp(event, point) { }

    onKeyDown(event) {
        if (event.key === 'n' || event.key === 'N' || event.key === 'Enter') {
            this.finalize();
        } else if (event.key === 'Escape') {
            this.cancel();
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            if (this.currentPoints.length > 0) {
                this.currentPoints.pop();
            }
        }
    }

    onActivate() { }

    onDeactivate() {
        this.currentPoints = [];
    }

    finalize() {
        if (this.currentPoints.length < 2) {
            console.warn('Outline needs at least 2 points');
            return;
        }

        const outlineId = crypto.randomUUID();
        userState.topo.outlines.push({
            id: outlineId,
            points2D: $state.snapshot(this.currentPoints)
        });

        this.currentPoints = [];
        this.saveHistory();
    }

    cancel() {
        this.currentPoints = [];
        if (userState.ui.selectedOutlineId) {
            userState.ui.selectedOutlineId = null;
        }
    }
}
