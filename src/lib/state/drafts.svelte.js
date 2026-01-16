import { storage } from '$lib/assets/js/storage-utils.js';
import { topoStore } from '$lib/assets/js/db.js';

const STORAGE_KEY = 'topo_drafts_v1';

export const draftsState = $state({
    drafts: [],

    init() {
        this.load();
    },

    load() {
        this.drafts = storage.get(STORAGE_KEY, []);
    },

    async save(topo, id = null) {
        const timestamp = new Date().toISOString();
        const draftId = id || topo.id || `draft-${Date.now()}`;

        const draftIndex = this.drafts.findIndex(d => d.id === draftId);

        // Metadata only for localStorage
        const metadata = {
            id: draftId,
            name: topo.name || 'Unbenanntes Topo',
            updated: timestamp
        };

        if (draftIndex >= 0) {
            this.drafts[draftIndex] = metadata;
        } else {
            this.drafts.unshift(metadata);
        }

        // Save metadata to localStorage
        storage.set(STORAGE_KEY, this.drafts);

        // Save full topo to IndexedDB
        const topoToSave = {
            ...JSON.parse(JSON.stringify(topo)),
            id: draftId // Ensure ID consistency
        };
        await topoStore.set(topoToSave);

        return draftId;
    },

    async delete(id) {
        this.drafts = this.drafts.filter(d => d.id !== id);
        storage.set(STORAGE_KEY, this.drafts);
        await topoStore.delete(id);
    },

    async getById(id) {
        return await topoStore.get(id);
    }
});
