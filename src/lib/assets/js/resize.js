let snapToBiggestHeight;

export function resize(element) {
	const top = document.createElement('div');
	top.direction = 'north';
	top.classList.add('grabber');
	top.classList.add('top');
	top.classList.add('sm:hidden');

	let active = null,
		initialRect = null,
		initialPos = null,
		lastY = null;
	let targetHeights = [];
	let minHeight, maxTop;

	function getEventY(event) {
		return event.pageY ? event.pageY : event.changedTouches[0].pageY;
	}

	function calculateTargetHeights() {
		const screenHeight = window.innerHeight;
		targetHeights = [screenHeight * 0.14, screenHeight * 0.5, screenHeight];

		minHeight = screenHeight * 0.14;
		maxTop = screenHeight - minHeight;
	}

	function calculateClosestHeight(currentHeight, direction) {
		let closestHeight;

		if (direction < 0) {
			// Moving up
			closestHeight = targetHeights.find((h) => h > currentHeight);
			if (!closestHeight) {
				closestHeight = targetHeights[targetHeights.length - 1];
			}
		} else if (direction > 0) {
			// Moving down
			closestHeight = targetHeights
				.slice()
				.reverse()
				.find((h) => h < currentHeight);
			if (!closestHeight) {
				closestHeight = targetHeights[0];
			}
		}

		return closestHeight;
	}

	function isMobile() {
		return window.innerWidth < 640;
	}

	function snapToClosestHeight() {
		if (!isMobile()) return; // Guard for desktop

		const currentTop = parseFloat(element.style.top);
		const currentHeight = parseFloat(element.style.height);
		let currentBottom = currentTop + currentHeight;

		let direction = 0;
		if (lastY !== null && initialPos !== null) {
			direction = lastY - initialPos.y;
		}

		const closestHeight = calculateClosestHeight(currentHeight, direction);

		element.style.transition =
			'top 0.2s ease-out, height 0.2s ease-out, border-radius 0.2s ease-out';
		document.body.style.setProperty('--info-panel-transition', 'bottom 0.2s ease-out');

		if (closestHeight === targetHeights[targetHeights.length - 1]) {
			// Full height
			element.style.top = `0`;
			element.style.borderRadius = `0`;
			element.style.height = `${closestHeight}px`;
		} else {
			// Partial height
			element.style.borderRadius = `1.5rem 1.5rem 0 0`;
			element.style.top = `${window.innerHeight - closestHeight}px`;
			element.style.height = `${closestHeight}px`;
		}

		document.body.style.setProperty('--info-panel-height', `${closestHeight}px`);

		// Ensure no inline margin overrides class styles on mobile (we want 0)
		element.style.marginInline = '';

		setTimeout(() => {
			element.style.transition = '';
			document.body.style.setProperty('--info-panel-transition', 'none');
		}, 200);
	}

	function resetState() {
		if (active) active.classList.remove('selected');
		active = null;
		initialRect = null;
		initialPos = null;
		lastY = null;
	}

	let lastTimestamp;

	function onMousedown(event) {
		if (!isMobile()) return;

		active = event.target;
		const rect = element.getBoundingClientRect();
		initialRect = { top: rect.top, height: rect.height };
		initialPos = { y: getEventY(event) };
		lastY = initialPos.y;
		lastTimestamp = Date.now();
		active.classList.add('selected');
		element.style.transition = 'border-radius 0.2s ease-out';
		document.body.style.setProperty('--info-panel-transition', 'none');

		// On interaction, ensure we are in partial-height style (rounded top only)
		element.style.borderRadius = `1.5rem 1.5rem 0 0`;
		// Remove inline margin to respect CSS class (w-auto left-0 right-0 -> 0 margin)
		element.style.marginInline = '';

		setTimeout(() => {
			element.style.transition = '';
			document.body.style.setProperty('--info-panel-transition', 'none');
		}, 200);
	}

	function onMouseup() {
		if (!active) return;
		snapToClosestHeight();
		resetState();
	}

	function onMove(event) {
		if (!active) return;

		const currentY = getEventY(event);
		let delta = initialPos.y - currentY;
		let newTop = initialRect.top - delta;

		// Clamp newTop between 0 and maxTop
		newTop = Math.max(0, Math.min(newTop, maxTop));

		// Calculate height to fill the rest of the screen to the bottom
		let newHeight = window.innerHeight - newTop;

		// Clamp height to minHeight (redundant if maxTop is correct, but safe)
		newHeight = Math.max(minHeight, newHeight);

		element.style.top = `${newTop}px`;
		element.style.height = `${newHeight}px`;
		document.body.style.setProperty('--info-panel-height', `${newHeight}px`);
		lastY = currentY;
	}

	let contentDragActive = false;
	let contentInitialY = null;
	let scrollContainer = null;
	let initialScrollTop = 0;

	function findScrollContainer(target) {
		let curr = target;
		while (curr && curr !== element && curr !== document.body) {
			const overflowY = window.getComputedStyle(curr).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') {
				if (curr.scrollHeight > curr.clientHeight) {
					return curr;
				}
			}
			curr = curr.parentNode;
		}
		return null;
	}

	function onContentTouchStart(event) {
		if (!isMobile() || active) return;
		if (event.target.closest('.grabber')) return;

		contentInitialY = getEventY(event);
		scrollContainer = findScrollContainer(event.target);
		initialScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
		contentDragActive = false;
	}

	function onContentTouchMove(event) {
		if (!isMobile() || contentInitialY === null || active === event.target) return;
		if (event.target.closest('.grabber')) return;

		const currentY = getEventY(event);
		const deltaY = currentY - contentInitialY;
		const currentHeight = parseFloat(element.style.height || 0);
		const maxHeight = targetHeights[targetHeights.length - 1];

		if (!contentDragActive) {
			let shouldDragPanel = false;

			if (deltaY < -5) {
				// Swipe UP (scroll down)
				if (Math.abs(currentHeight - maxHeight) > 5) {
					shouldDragPanel = true;
				}
			} else if (deltaY > 5) {
				// Swipe DOWN (scroll up)
				if (initialScrollTop <= 0) {
					shouldDragPanel = true;
				}
			}

			if (shouldDragPanel) {
				contentDragActive = true;
				active = element;
				const rect = element.getBoundingClientRect();
				initialRect = { top: rect.top, height: rect.height };
				initialPos = { y: contentInitialY };
				lastY = contentInitialY;
				lastTimestamp = Date.now();

				element.style.transition = 'border-radius 0.2s ease-out';
				document.body.style.setProperty('--info-panel-transition', 'none');
				element.style.borderRadius = `1.5rem 1.5rem 0 0`;
				element.style.marginInline = '';
			}
		}

		if (contentDragActive) {
			if (event.cancelable) event.preventDefault();
			onMove(event);
		}
	}

	function onContentTouchEnd(event) {
		if (contentDragActive) {
			onMouseup();
			contentDragActive = false;
		}
		contentInitialY = null;
		scrollContainer = null;
	}

	calculateTargetHeights();
	element.appendChild(top);
	top.addEventListener('mousedown', onMousedown);
	top.addEventListener('touchstart', onMousedown);

	window.addEventListener('mousemove', onMove, { passive: false });
	window.addEventListener('touchmove', onMove, { passive: false });
	window.addEventListener('mouseup', onMouseup);
	window.addEventListener('touchend', onMouseup);
	window.addEventListener('resize', calculateTargetHeights);

	element.addEventListener('touchstart', onContentTouchStart, { passive: true });
	element.addEventListener('touchmove', onContentTouchMove, { passive: false });
	element.addEventListener('touchend', onContentTouchEnd);

	snapToBiggestHeight = () => {
		if (!isMobile()) return;

		element.style.transition =
			'top 0.2s ease-out, height 0.2s ease-out, border-radius 0.2s ease-out';
		document.body.style.setProperty('--info-panel-transition', 'bottom 0.2s ease-out');
		element.style.marginInline = ''; // Clear inline margin
		element.style.top = `0`;
		element.style.borderRadius = `0`;
		element.style.height = `${window.innerHeight}px`;
		document.body.style.setProperty('--info-panel-height', `${window.innerHeight}px`);

		setTimeout(() => {
			element.style.transition = '';
			document.body.style.setProperty('--info-panel-transition', 'none');
		}, 200);
	};

	return {
		destroy() {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mousedown', onMousedown);
			window.removeEventListener('mouseup', onMouseup);
			window.removeEventListener('touchend', onMouseup);
			window.removeEventListener('resize', calculateTargetHeights);
			
			element.removeEventListener('touchstart', onContentTouchStart);
			element.removeEventListener('touchmove', onContentTouchMove);
			element.removeEventListener('touchend', onContentTouchEnd);

			if (element.contains(top)) {
				element.removeChild(top);
			}
			document.body.style.removeProperty('--info-panel-height');
		}
	};
}

export { snapToBiggestHeight };
