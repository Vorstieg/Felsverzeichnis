<script lang="ts">
	import PhotoSwipeLightbox from 'photoswipe/lightbox';
	import 'photoswipe/style.css';
	import type { SlideData } from 'photoswipe';
	import { onMount, onDestroy } from 'svelte';

	let {
		images = [],
		startIndex = 0,
		onClose = () => {}
	}: { images?: string[]; startIndex?: number; onClose?: () => void } = $props();

	let lightbox: PhotoSwipeLightbox;
	let closedByNavigation = false;

	const handlePopState = () => {
		closedByNavigation = true;
		if (lightbox && lightbox.pswp) {
			lightbox.pswp.close();
		} else {
			onClose();
		}
	};

	onMount(async () => {
		// Push a history state so the hardware back button closes the viewer
		history.pushState({ viewer: 'photoswipe' }, '');
		window.addEventListener('popstate', handlePopState);

		// 3. Preload all image dimensions
		const dataSource = await Promise.all(
			images.map((src) => {
				return new Promise<SlideData>((resolve) => {
					const img = new Image();
					img.onload = () => resolve({ src, width: img.width, height: img.height });
					img.onerror = () =>
						resolve({ src, width: window.innerWidth, height: window.innerHeight }); // fallback
					img.src = src;
				});
			})
		);

		lightbox = new PhotoSwipeLightbox({
			dataSource,
			pswpModule: () => import('photoswipe'),
			// Some nice mobile defaults
			zoom: true,
			clickToCloseNonZoomable: false,
			bgOpacity: 0.9,
			showHideAnimationType: 'fade'
		});

		// 5. Hook up the close event to our component state
		lightbox.on('close', () => {
			if (!closedByNavigation) {
				history.back(); // consume the state we pushed
			}
			onClose();
		});

		// Initialize and open at the correct index
		lightbox.init();
		lightbox.loadAndOpen(startIndex);
	});

	onDestroy(() => {
		window.removeEventListener('popstate', handlePopState);
		if (lightbox) {
			lightbox.destroy();
		}
	});
</script>

<!-- No HTML needed, PhotoSwipe generates its own full-screen portal automatically -->

<style>
	:global(.pswp__button--zoom) {
		display: none !important;
	}

	/* Match InfoPanel close button symbol but keep native bright/no-background style */
	:global(.pswp__button--close) {
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		color: white !important;
		opacity: 0.8 !important;
	}

	:global(.pswp__button--close:hover) {
		opacity: 1 !important;
	}

	:global(.pswp__button--close:active) {
		opacity: 0.7 !important;
	}

	/* Hide the default SVG icon */
	:global(.pswp__button--close svg) {
		display: none !important;
	}

	/* Inject FontAwesome xmark */
	:global(.pswp__button--close::after) {
		content: '\f00d'; /* FontAwesome xmark unicode */
		font-family: 'Font Awesome 6 Free';
		font-weight: 900;
		font-size: 1.25em; /* slightly smaller, matching typical fa-lg size */
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}
</style>
