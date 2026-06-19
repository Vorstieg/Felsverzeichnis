/**
 * Safe localStorage utilities
 */

export const storage = {
	/**
	 * Save data to localStorage
	 * @param {string} key
	 * @param {any} value
	 * @returns {boolean} Success
	 */
	set(key, value) {
		try {
			if (typeof window === 'undefined') return false;
			const data = JSON.stringify(value);
			window.localStorage.setItem(key, data);
			return true;
		} catch (e) {
			console.error('Storage Error (set):', e);
			return false;
		}
	},

	/**
	 * Get data from localStorage
	 * @param {string} key
	 * @param {any} defaultValue
	 * @returns {any}
	 */
	get(key, defaultValue = null) {
		try {
			if (typeof window === 'undefined') return defaultValue;
			const data = window.localStorage.getItem(key);
			if (!data) return defaultValue;
			return JSON.parse(data);
		} catch (e) {
			console.error('Storage Error (get):', e);
			return defaultValue;
		}
	},

	/**
	 * Remove data from localStorage
	 * @param {string} key
	 */
	remove(key) {
		try {
			if (typeof window === 'undefined') return;
			window.localStorage.removeItem(key);
		} catch (e) {
			console.error('Storage Error (remove):', e);
		}
	}
};
