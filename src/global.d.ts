/// <reference types="@sveltejs/kit" />

import type { Map } from 'maplibre-gl';
import type {
	AccessCollection,
	MapCameraTarget,
	MapFocusTarget,
	PageMeta
} from '$lib/types/application';
import type { FelsLocation } from '$lib/types/files';
import type { PathFeature } from '@vorstieg/fels-types/types';

declare global {
	namespace App {
		interface PageData {
			name?: string;
			description?: string;
			description_de?: string;
			description_en?: string;
			meta?: PageMeta;
			locations?: FelsLocation[];
			allLocations?: FelsLocation[];
			access?: AccessCollection | null;
			topoPaths?: PathFeature[];
			cameraTarget?: MapCameraTarget | null;
		}
	}
	interface Window {
		__climbingMap?: Map;
	}
	interface WindowEventMap {
		'crag-review:focus-map-target': CustomEvent<MapFocusTarget>;
		'route-clicked': CustomEvent<void>;
	}
	interface Navigator {
		connection?: { saveData?: boolean; effectiveType?: string; type?: string };
	}
}

declare module 'svelte/elements' {
	interface HTMLAttributes<T extends EventTarget> {
		'overflow-y'?: boolean;
	}
	interface SvelteWindowAttributes {
		'onroute-clicked'?: (event: CustomEvent<void>) => void;
	}
}
