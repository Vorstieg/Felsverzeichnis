/**
 * Catalog search & filtering backed by Meilisearch.
 *
 * Felslager keeps the index in sync with the files on disk (see Felslager `search.js`
 * for the document schema). Felsverzeichnis queries Meilisearch directly with the
 * public, read-only search key.
 *
 * Filters are plain data (`SearchFilters`) so UI components can be added one by one:
 * they only need to produce a `SearchFilters` object (or URL params via
 * `filtersToParams`); `buildFilter` turns it into a Meilisearch filter expression.
 */
import { meiliIndex, meiliSearchKey, meiliUrl, types as climbingTypes } from '$lib/config';
import { getGradeScaleOrder } from '$lib/assets/js/grades.js';
import type { EntryKind, Grade } from '@vorstieg/fels-types/types';
import type { FelsLocation } from '$lib/types/files';

export type GeoPoint = { lat: number; lng: number };

export interface SearchFilters {
	/** Climbing styles, any of (e.g. `sports-climbing`, `multi-pitch`). */
	types?: string[];
	/** Standardized grade bounds (inclusive), e.g. `5a` .. `7a+`. */
	gradeMin?: string;
	gradeMax?: string;
	/** Route length in meters (routes only). */
	lengthMin?: number;
	lengthMax?: number;
	/** Pitch count (routes only). */
	pitchesMin?: number;
	pitchesMax?: number;
	/** Entry kinds (entries only). */
	kinds?: EntryKind[];
	/** Folder path; restricts results to everything inside it (e.g. `europe/austria`). */
	within?: string;
	/** Map viewport `[west, south, east, north]`. */
	bbox?: [number, number, number, number];
	/** Radius search around a point, in meters. */
	around?: GeoPoint & { radius: number };
}

interface BaseHit {
	id: string;
	name: string;
	/** Entry folder path (for routes: the entry holding the topo). */
	path: string;
	breadcrumb: string[];
	types: string[];
	grades: number[];
	gradeMin?: number;
	gradeMax?: number;
	_geo?: GeoPoint;
}
export interface EntryHit extends BaseHit {
	docType: 'entry';
	kind: EntryKind;
	routeCount: number;
}
export interface RouteHit extends BaseHit {
	docType: 'route';
	routeId: string;
	entryName: string;
	grade?: NonNullable<Grade>;
	length?: number;
	pitchCount?: number;
}
export type SearchHit = EntryHit | RouteHit;

export interface SearchResults {
	entries: EntryHit[];
	routes: RouteHit[];
	entryTotal: number;
	routeTotal: number;
}

export interface SearchOptions {
	q?: string;
	filters?: SearchFilters;
	entryLimit?: number;
	routeLimit?: number;
	signal?: AbortSignal;
	/** Abort the Meilisearch request after this many ms (SSR safety). */
	timeoutMs?: number;
	fetch?: typeof globalThis.fetch;
}

export interface SearchClientConfig {
	url: string;
	apiKey: string;
	index: string;
}

/** Fields that only exist on route documents. */
const ROUTE_ONLY: (keyof SearchFilters)[] = ['lengthMin', 'lengthMax', 'pitchesMin', 'pitchesMax'];

export const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function gradeIndex(grade: string | undefined, climbingType?: string) {
	if (!grade) return -1;
	const order = getGradeScaleOrder(climbingType);
	const std = grade.trim();
	const exact = order.indexOf(std);
	if (exact >= 0) return exact;
	const lower = std.toLowerCase();
	return order.findIndex((item) => item.toLowerCase() === lower);
}

/** Grade label for a numeric rank stored in the index. */
export function gradeFromRank(rank: number | undefined, climbingType?: string) {
	if (rank === undefined) return undefined;
	const order = getGradeScaleOrder(climbingType);
	return order[rank];
}

function range(field: string, min?: number, max?: number) {
	const hasMin = min !== undefined && Number.isFinite(min);
	const hasMax = max !== undefined && Number.isFinite(max);
	if (hasMin && hasMax) return `${field} ${min} TO ${max}`;
	if (hasMin) return `${field} >= ${min}`;
	if (hasMax) return `${field} <= ${max}`;
	return null;
}

export function hasRouteOnlyFilters(filters: SearchFilters = {}) {
	return ROUTE_ONLY.some((key) => filters[key] !== undefined);
}

export function countActiveFilters(filters: SearchFilters = {}) {
	return (
		(filters.types?.length ? 1 : 0) +
		(filters.gradeMin || filters.gradeMax ? 1 : 0) +
		(filters.lengthMin !== undefined || filters.lengthMax !== undefined ? 1 : 0) +
		(filters.pitchesMin !== undefined || filters.pitchesMax !== undefined ? 1 : 0) +
		(filters.kinds?.length ? 1 : 0) +
		(filters.within ? 1 : 0) +
		(filters.bbox ? 1 : 0) +
		(filters.around ? 1 : 0)
	);
}

/**
 * Builds the Meilisearch filter (AND-ed expressions) for one document type.
 * Route-only filters are skipped for entries; entry-only filters for routes.
 */
export function buildFilter(filters: SearchFilters = {}, docType?: 'entry' | 'route') {
	const parts: string[] = [];
	if (docType) parts.push(`docType = ${quote(docType)}`);
	if (filters.types?.length) parts.push(`types IN [${filters.types.map(quote).join(', ')}]`);
	const primaryType = filters.types?.length === 1 ? filters.types[0] : undefined;
	const gMin = gradeIndex(filters.gradeMin, primaryType);
	const gMax = gradeIndex(filters.gradeMax, primaryType);
	const grades = range('grades', gMin >= 0 ? gMin : undefined, gMax >= 0 ? gMax : undefined);
	if (grades) parts.push(grades);
	if (docType !== 'entry') {
		const length = range('length', filters.lengthMin, filters.lengthMax);
		if (length) parts.push(length);
		const pitches = range('pitchCount', filters.pitchesMin, filters.pitchesMax);
		if (pitches) parts.push(pitches);
	}
	if (docType !== 'route' && filters.kinds?.length)
		parts.push(`kind IN [${filters.kinds.map(quote).join(', ')}]`);
	if (filters.within)
		parts.push(`(ancestorPaths = ${quote(filters.within)} OR path = ${quote(filters.within)})`);
	if (filters.bbox) {
		const [west, south, east, north] = filters.bbox;
		parts.push(`_geoBoundingBox([${north}, ${east}], [${south}, ${west}])`);
	}
	if (filters.around) {
		const { lat, lng, radius } = filters.around;
		parts.push(`_geoRadius(${lat}, ${lng}, ${radius})`);
	}
	return parts;
}

// ---------------------------------------------------------------------------
// URL <-> filters
// ---------------------------------------------------------------------------

const numberParam = (value: string | null) => {
	if (value === null || value.trim() === '') return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
};
const listParam = (value: string | null) =>
	value
		? value
				.split(',')
				.map((v) => v.trim())
				.filter(Boolean)
		: [];

/** Reads filters from URL params (`type`, `gmin`, `gmax`, `lmin`, `lmax`, `pmin`, `pmax`, `kind`, `in`). */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
	const filters: SearchFilters = {};
	const types = listParam(params.get('type'));
	if (types.length) filters.types = types;
	const gmin = params.get('gmin');
	const gmax = params.get('gmax');
	const primaryType = types.length === 1 ? types[0] : undefined;
	if (gmin && gradeIndex(gmin, primaryType) >= 0) filters.gradeMin = gmin;
	if (gmax && gradeIndex(gmax, primaryType) >= 0) filters.gradeMax = gmax;
	const numeric: [keyof SearchFilters, string][] = [
		['lengthMin', 'lmin'],
		['lengthMax', 'lmax'],
		['pitchesMin', 'pmin'],
		['pitchesMax', 'pmax']
	];
	for (const [key, param] of numeric) {
		const value = numberParam(params.get(param));
		if (value !== undefined) (filters as Record<string, unknown>)[key] = value;
	}
	const kinds = listParam(params.get('kind')) as EntryKind[];
	if (kinds.length) filters.kinds = kinds;
	const within = params.get('in');
	if (within) filters.within = within;
	return filters;
}

export function filtersToParams(filters: SearchFilters, params = new URLSearchParams()) {
	const set = (key: string, value: string | number | undefined) => {
		if (value === undefined || value === '') params.delete(key);
		else params.set(key, String(value));
	};
	set('type', filters.types?.length ? filters.types.join(',') : undefined);
	set('gmin', filters.gradeMin);
	set('gmax', filters.gradeMax);
	set('lmin', filters.lengthMin);
	set('lmax', filters.lengthMax);
	set('pmin', filters.pitchesMin);
	set('pmax', filters.pitchesMax);
	set('kind', filters.kinds?.length ? filters.kinds.join(',') : undefined);
	set('in', filters.within);
	return params;
}

/**
 * Interprets the `/map/[search]` path segment: climbing types (the style chips
 * on the map) and folder paths (breadcrumb links) become filters, anything else
 * is a free-text query.
 */
export function interpretSearchTerm(term: string, filters: SearchFilters = {}) {
	const value = (term ?? '').trim();
	if (climbingTypes.includes(value)) {
		return {
			q: '',
			filters: { ...filters, types: [...new Set([...(filters.types ?? []), value])] }
		};
	}
	if (value.includes('/')) return { q: '', filters: { ...filters, within: value } };
	return { q: value, filters };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const ENTRY_ATTRIBUTES = [
	'id',
	'docType',
	'kind',
	'name',
	'path',
	'breadcrumb',
	'types',
	'grades',
	'gradeMin',
	'gradeMax',
	'routeCount',
	'_geo'
];
const ROUTE_ATTRIBUTES = [
	'id',
	'docType',
	'routeId',
	'name',
	'path',
	'entryName',
	'breadcrumb',
	'types',
	'grades',
	'gradeMin',
	'gradeMax',
	'grade',
	'length',
	'pitchCount',
	'_geo'
];

type MeiliResult<T> = {
	hits: T[];
	estimatedTotalHits?: number;
	totalHits?: number;
	facetDistribution?: Record<string, Record<string, number>>;
};

export function defaultSearchConfig(): SearchClientConfig | null {
	return meiliUrl && meiliSearchKey
		? { url: meiliUrl, apiKey: meiliSearchKey, index: meiliIndex }
		: null;
}

export function isSearchConfigured() {
	return defaultSearchConfig() !== null;
}

const emptyResults = (): SearchResults => ({
	entries: [],
	routes: [],
	entryTotal: 0,
	routeTotal: 0
});

/**
 * Searches entries (crags, sectors, areas …) and routes in one round trip.
 */
export async function searchCatalog(
	options: SearchOptions,
	config: SearchClientConfig | null = defaultSearchConfig()
): Promise<SearchResults> {
	if (!config) return emptyResults();
	const { q = '', filters = {}, entryLimit = 5, routeLimit = 5 } = options;
	const fetcher = options.fetch ?? globalThis.fetch;
	const signals = [
		options.signal,
		options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined
	].filter((s): s is AbortSignal => !!s);
	const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
	const routeOnly = hasRouteOnlyFilters(filters);

	const multiSearch = async (queries: Record<string, unknown>[]) => {
		const res = await fetcher(`${config.url}/multi-search`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
			body: JSON.stringify({
				queries: queries.map((query) => ({ indexUid: config.index, ...query }))
			}),
			signal
		});
		if (!res.ok) throw new Error(`Search failed with ${res.status}`);
		return ((await res.json()) as { results: MeiliResult<unknown>[] }).results;
	};
	const total = (result: MeiliResult<unknown>) =>
		result.totalHits ?? result.estimatedTotalHits ?? result.hits.length;

	try {
		const routeQuery = {
			q,
			filter: buildFilter(filters, 'route'),
			limit: routeLimit,
			attributesToRetrieve: ROUTE_ATTRIBUTES,
			// Route-only filters (length, pitches) cannot apply to entries directly:
			// collect the entries that hold matching routes instead.
			...(routeOnly ? { facets: ['path'] } : {})
		};
		const entryQuery = {
			q,
			filter: buildFilter(filters, 'entry'),
			limit: entryLimit,
			attributesToRetrieve: ENTRY_ATTRIBUTES
		};
		let [routeResult, entryResult] = await multiSearch(
			routeOnly ? [routeQuery] : [routeQuery, entryQuery]
		);
		if (routeOnly) {
			const paths = Object.keys(routeResult.facetDistribution?.path ?? {});
			entryResult = paths.length
				? (
						await multiSearch([
							{
								...entryQuery,
								q: '',
								filter: [
									...buildFilter(filters, 'entry'),
									`path IN [${paths.map(quote).join(', ')}]`
								]
							}
						])
					)[0]
				: { hits: [], totalHits: 0 };
		}
		return {
			entries: entryResult.hits as EntryHit[],
			routes: routeResult.hits as RouteHit[],
			entryTotal: total(entryResult),
			routeTotal: total(routeResult)
		};
	} catch (error) {
		if (options.signal?.aborted) throw error;
		return emptyResults();
	}
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export function entryHitUrl(
	base: string,
	hit: Pick<EntryHit, 'path'> & Partial<Pick<EntryHit, '_geo' | 'kind'>>
) {
	const isAreaOrRegion = hit.kind && ['area', 'region', 'country'].includes(hit.kind);
	const hash = hit._geo && !isAreaOrRegion ? `#16/${hit._geo.lat}/${hit._geo.lng}` : '';
	return `${base}/map/crag/${hit.path}${hash}`;
}

export function routeHitUrl(base: string, hit: Pick<RouteHit, 'path' | 'routeId'>) {
	return `${base}/map/crag/${hit.path}/${encodeURIComponent(hit.routeId)}`;
}

/** Turns an entry hit into the `FelsLocation` shape used by existing components. */
export function entryHitToLocation(hit: EntryHit, locations: FelsLocation[] = []): FelsLocation {
	const known = locations.find((location) => location.path === hit.path);
	if (known) return known;
	return {
		path: hit.path,
		entry: {
			type: 'Feature',
			properties: {
				id: hit.path.split('/').at(-1) ?? hit.path,
				name: hit.name,
				kind: hit.kind,
				type: hit.types
			},
			geometry: { type: 'Point', coordinates: hit._geo ? [hit._geo.lng, hit._geo.lat] : [0, 0] }
		}
	};
}
