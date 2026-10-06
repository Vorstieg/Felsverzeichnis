import type { ClimbingLine, FelsTopoDocument, Position, Route } from '@vorstieg/fels-types/types';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Vector3 } from 'three';
import type { calculateBestSeason, calculateSunInfo } from '$lib/assets/js/sun-calculations';

export type RouteId = Route['id'];
export interface GpxTrack {
	name?: string;
	role: string;
	coordinates: Position[];
}
export type RouteSummary = Route & {
	downloadTracks?: GpxTrack[];
	sectorId?: string;
	sectorName?: string;
	sectorTags?: string[];
	sectorWallAzimuth?: FelsTopoDocument['wallAzimuth'];
};
export type SelectedClimbingLine = ClimbingLine &
	Partial<
		Pick<
			Route,
			| 'name'
			| 'type'
			| 'description'
			| 'boltAmount'
			| 'tags'
			| 'pitches'
			| 'variants'
			| 'fixPoints'
			| 'pathRefs'
			| 'orientation'
		>
	> & { parentId?: RouteId };
export type VisualClimbingLine = SelectedClimbingLine & { originalRoute?: Route };
export interface AccessProperties {
	kind: string;
	name?: string;
	mode?: string;
}
export type AccessCollection = FeatureCollection<Geometry, AccessProperties> & { version?: number };
export type SunInfo = ReturnType<typeof calculateSunInfo>;
export type SeasonData = ReturnType<typeof calculateBestSeason>;
export interface SteepnessMetrics {
	slab: number;
	vertical: number;
	overhang: number;
}
export interface CameraAnimation {
	startPos: Vector3;
	endPos: Vector3;
	startTarget: Vector3;
	endTarget: Vector3;
	startTime: number;
	duration: number;
}
export type MapCameraTarget =
	| { type: 'center'; center: [number, number]; zoom: number }
	| {
			type: 'bounds';
			bounds: [[number, number], [number, number]];
			padding: number;
			maxZoom: number;
	  };
export interface MapFocusTarget {
	center: [number, number];
	zoom?: number;
	path?: string;
}
export interface SectorTopo {
	sectorId: string;
	sectorName?: string;
	topo: FelsTopoDocument | null;
	has3DTopo?: boolean;
	has2DTopo?: boolean;
}
export type ImprovementTask = 'access' | 'core' | 'topo' | 'routes' | 'visual';
export interface ImprovementIssue {
	rule: ImprovementTask;
	copyKey: string;
	task: ImprovementTask;
	target: { cragPath: string; sectorId: string | null };
}
export interface PageMeta {
	lang: string;
	type: string;
	title: string;
	description?: string;
	author?: string;
	url: string;
}
