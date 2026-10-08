/**
 * Mobile utility functions for touch detection and interaction helpers
 */

/**
 * Detect if the device supports touch events
 * @returns {boolean} True if touch is supported
 */
export function isTouchDevice() {
	return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get appropriate touch target size based on device type
 * @param {number} baseSize - Base size for non-touch devices
 * @returns {number} Adjusted size for touch devices
 */
export function getTouchTargetSize(baseSize) {
	return isTouchDevice() ? Math.max(baseSize * 2, 12) : baseSize;
}

/**
 * Get appropriate hit area size for routes/paths
 * @param {number} baseSize - Base size for non-touch devices
 * @returns {number} Adjusted size for touch devices
 */
export function getHitAreaSize(baseSize) {
	return isTouchDevice() ? Math.max(baseSize * 2, 18) : baseSize;
}

/**
 * Trigger haptic feedback if available (mobile devices)
 * @param {'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'} type - 'light', 'medium', 'heavy', 'selection', 'success', 'warning', 'error'
 */
export function vibrateOnAction(type = 'light') {
	if (!navigator.vibrate) return;

	const patterns = {
		light: 10,
		medium: 20,
		heavy: 30,
		selection: 5,
		success: [10, 50, 10],
		warning: [20, 100, 20],
		error: [50, 100, 50]
	};

	const pattern = patterns[type] || patterns.light;
	navigator.vibrate(pattern);
}

/**
 * Extract touch point from touch event (similar to mouse event handling)
 * @param {TouchEvent} event - Touch event
 * @param {SVGSVGElement} svgElement - SVG element for coordinate transformation
 * @param {Pick<import("d3-zoom").ZoomTransform, "x" | "y" | "k">} transform - D3 zoom transform {x, y, k}
 * @param {number} baseWidth - SVG base width
 * @param {number} baseHeight - SVG base height
 * @returns {{x: number, y: number} | null} Normalized point (0-1 range) or null
 */
export function getTouchPoint(event, svgElement, transform, baseWidth, baseHeight) {
	if (!svgElement || !event.touches || event.touches.length === 0) return null;

	const touch = event.touches[0];
	const pt = svgElement.createSVGPoint();
	pt.x = touch.clientX;
	pt.y = touch.clientY;

	const matrix = svgElement.getScreenCTM();
	if (!matrix) return null;
	const svgP = pt.matrixTransform(matrix.inverse());

	// Apply inverse D3 zoom transform to get coordinates in base space
	const transformedX = (svgP.x - transform.x) / transform.k;
	const transformedY = (svgP.y - transform.y) / transform.k;

	// Normalize to 0-1 range
	return {
		x: transformedX / baseWidth,
		y: transformedY / baseHeight
	};
}

/**
 * Detect long press gesture
 * @param {(event: TouchEvent | MouseEvent) => void} callback - Function to call on long press
 * @param {number} duration - Duration in ms (default 500ms)
 */
export function createLongPressDetector(callback, duration = 500) {
	/** @type {ReturnType<typeof setTimeout> | null} */
	let timer = null;
	/** @type {{x: number, y: number} | null} */
	let startPoint = null;
	const moveThreshold = 10; // pixels

	return {
		/** @param {TouchEvent | MouseEvent} event */
		start(event) {
			const touch = 'touches' in event ? event.touches[0] : event;
			startPoint = { x: touch.clientX, y: touch.clientY };

			timer = setTimeout(() => {
				if (callback) callback(event);
				timer = null;
			}, duration);
		},

		/** @param {TouchEvent | MouseEvent} event */
		move(event) {
			if (!timer || !startPoint) return;

			const touch = 'touches' in event ? event.touches[0] : event;
			const dx = touch.clientX - startPoint.x;
			const dy = touch.clientY - startPoint.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Cancel if moved too far
			if (distance > moveThreshold) {
				this.cancel();
			}
		},

		cancel() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			startPoint = null;
		}
	};
}

/**
 * Check if the viewport is mobile-sized
 * @returns {boolean} True if viewport width is less than 768px
 */
export function isMobileViewport() {
	return window.innerWidth < 768;
}

/**
 * Prevent default touch behavior (e.g., scroll, zoom) for editing interactions
 * @param {TouchEvent} event - Touch event
 */
export function preventDefaultTouch(event) {
	event.preventDefault();
}
