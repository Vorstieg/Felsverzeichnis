const protectedRouteTypes = new Set(['sports-climbing', 'via-ferrata']);

/** @param {string | null | undefined} value */
function hasText(value) {
	return Boolean(value?.trim());
}

/** @param {import('@vorstieg/fels-types/types').FelsTopoDocument | null | undefined} topo */
export function has2DTopo(topo) {
	return Boolean(
		topo?.image2D ||
		topo?.outlines?.length ||
		topo?.fixPoints?.some((point) => point.position2D) ||
		topo?.textLabels?.some((label) => label.position2D) ||
		topo?.routes.some((route) => hasRouteLine(route, 'points2D'))
	);
}

/** @param {import('@vorstieg/fels-types/types').Route} route
 * @param {'points2D' | 'points3D'} property */
function hasRouteLine(route, property) {
	return Boolean(
		route[property] ||
		route.pitches?.some((pitch) => pitch[property]) ||
		route.variants?.some((variant) => variant[property])
	);
}

/** @param {import('$lib/types/application').ImprovementTask} rule
 * @param {string} cragPath
 * @param {string | null} [sectorId]
 * @returns {import('$lib/types/application').ImprovementIssue} */
function issue(rule, cragPath, sectorId = null) {
	return { rule, copyKey: `validation.rules.${rule}`, task: rule, target: { cragPath, sectorId } };
}

/** Suggest an improvement for optional content in existing published entries.
 * @param {{crag: import('@vorstieg/fels-types/types').FelsEntry | null,
 * current?: import('@vorstieg/fels-types/types').FelsEntry | null,
 * sectors?: import('$lib/types/files').FelsLocation[],
 * access?: import('$lib/types/application').AccessCollection | null,
 * topo?: import('@vorstieg/fels-types/types').FelsTopoDocument | null,
 * sectorTopos?: import('$lib/types/application').SectorTopo[],
 * has3DTopo?: boolean, has2DTopo?: boolean, images?: string[], cragPath: string, sectorId?: string | null}} input */
export function getCragValidationIssue({
	crag,
	sectors = [],
	access,
	topo,
	sectorTopos = [],
	has3DTopo = false,
	has2DTopo: currentHas2DTopo,
	images = [],
	cragPath,
	sectorId = null
}) {
	if (!access?.features.length) return issue('access', cragPath);
	if (!crag) return null;
	if (
		![crag.properties.description_de, crag.properties.description_en].some(hasText) ||
		!crag.properties.type?.length
	)
		return issue('core', cragPath);
	const topoEntries = [
		{ sectorId, topo, has3DTopo, has2DTopo: currentHas2DTopo ?? has2DTopo(topo) },
		...sectorTopos.map((entry) => ({
			...entry,
			has2DTopo: entry.has2DTopo ?? has2DTopo(entry.topo)
		}))
	];
	const uniqueTopos = topoEntries.filter(
		(entry, index, entries) =>
			entries.findIndex((candidate) => candidate.sectorId === entry.sectorId) === index
	);
	if (
		(sectorId || sectors.length) &&
		!uniqueTopos.some((entry) => entry.has2DTopo || entry.has3DTopo)
	)
		return issue('topo', cragPath, sectorId ?? sectors[0]?.entry.properties.id);
	for (const entry of uniqueTopos) {
		for (const route of entry.topo?.routes ?? []) {
			if (
				!hasText(route.name) ||
				!route.grade?.standardizedValue ||
				(!hasRouteLine(route, 'points2D') && !hasRouteLine(route, 'points3D')) ||
				(route.type &&
					protectedRouteTypes.has(route.type) &&
					!route.boltAmount &&
					!route.fixPoints?.length)
			)
				return issue('routes', cragPath, entry.sectorId);
		}
	}
	if (
		!images.length &&
		uniqueTopos.some((entry) => entry.has2DTopo || entry.has3DTopo || entry.topo?.routes.length)
	)
		return issue('visual', cragPath, sectorId);
	return null;
}

/** @param {string} baseUrl
 * @param {{cragPath: string, sectorId?: string | null}} parameters */
export function buildFelsstudioUrl(baseUrl, { cragPath, sectorId }) {
	if (!baseUrl) return null;
	const url = new URL(baseUrl);
	const entryPath = sectorId ? `${cragPath}/${sectorId}` : cragPath;
	url.pathname = `${url.pathname.replace(/\/$/, '')}/crags/editor/${entryPath
		.split('/')
		.map(encodeURIComponent)
		.join('/')}`;
	return url.toString();
}
