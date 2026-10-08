/**
 * Simple IndexedDB wrapper for storing topo data
 */

const DB_NAME = 'TopoCreatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'topos';

/**
 * Open the database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB is not supported'));
			return;
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Generic request wrapper
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function wrap(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export const topoStore = {
	/**
	 * Get a topo by ID
	 * @param {string} id
	 * @returns {Promise<import('@vorstieg/fels-types/types').FelsTopoDocument | null | undefined>}
	 */
	async get(id) {
		try {
			const db = await openDB();
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			/** @type {IDBRequest<import('@vorstieg/fels-types/types').FelsTopoDocument | undefined>} */
			const request = store.get(id);
			return wrap(request);
		} catch (e) {
			console.error('IndexedDB Error (get):', e);
			return null;
		}
	},

	/**
	 * Save a topo
	 * @param {import("@vorstieg/fels-types/types").FelsTopoDocument & {id: string}} topo
	 * @returns {Promise<void>}
	 */
	async set(topo) {
		try {
			const db = await openDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			await wrap(store.put(topo));
		} catch (e) {
			console.error('IndexedDB Error (set):', e);
			throw e;
		}
	},

	/**
	 * Delete a topo
	 * @param {string} id
	 * @returns {Promise<void>}
	 */
	async delete(id) {
		try {
			const db = await openDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			await wrap(store.delete(id));
		} catch (e) {
			console.error('IndexedDB Error (delete):', e);
		}
	}
};
