/**
 * UUID v4 generator with fallback for browsers that don't support crypto.randomUUID()
 * This is especially important for older mobile browsers
 */
export function generateUUID() {
	// Use native crypto.randomUUID if available
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	// Fallback implementation for older browsers
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
