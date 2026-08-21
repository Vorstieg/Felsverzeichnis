const protectedRouteTypes = new Set(['sports-climbing', 'via-ferrata']);

function hasText(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function hasCoordinates(value) {
	if (!Array.isArray(value)) return false;
	if (value.length >= 2 && value.every((entry) => typeof entry === 'number')) {
		return Number.isFinite(value[0]) && Number.isFinite(value[1]);
	}
	return value.some(hasCoordinates);
}

function hasValidGeometry(geometry) {
	return Boolean(geometry?.type && hasCoordinates(geometry.coordinates));
}

function hasAccessInformation(access) {
	const features = access?.features || [];
	if (
		features.some((feature) =>
			['approach', 'parking', 'transit', 'restriction', 'access'].includes(
				feature?.properties?.kind
			)
		)
	)
		return true;

	return [access, access?.properties].some((source) =>
		[
			'description',
			'notes',
			'restrictions',
			'restriction',
			'access',
			'approach',
			'parking',
			'transit'
		].some((key) => hasText(source?.[key]))
	);
}

function has2DTopo(topo) {
	return Boolean(
		topo?.image2D ||
			topo?.outlines?.length ||
			topo?.fixPoints?.some((point) => point.position2D) ||
			topo?.textLabels?.some((label) => label.position2D) ||
			topo?.routes?.some((route) => hasRouteLine(route, 'points2D'))
	);
}

function hasRouteLine(route, property) {
	return Boolean(
		route?.[property]?.length > 1 ||
			route?.pitches?.some((pitch) => hasRouteLine(pitch, property)) ||
			route?.variants?.some((variant) => hasRouteLine(variant, property))
	);
}

function hasRouteProtection(route, topo) {
	return Boolean(
		route?.protection ||
			route?.bolts ||
			route?.boltAmount ||
			route?.fixPoints?.length ||
			topo?.fixPoints?.some((point) => route?.fixPoints?.includes(point.id))
	);
}

function routeNeedsProtection(route) {
	const types = Array.isArray(route?.type) ? route.type : [route?.type];
	return types.some((type) => protectedRouteTypes.has(type));
}

function target(cragPath, sectorId = null) {
	return { cragPath, sectorId: sectorId || null };
}

function issue(rule, cragPath, sectorId = null) {
	return {
		rule,
		copyKey: `validation.rules.${rule}`,
		task: rule,
		target: target(cragPath, sectorId)
	};
}

/**
 * Returns the one most useful improvement for a crag detail page.
 * Sectors and routes are deliberately inspected only when they exist.
 */
export function getCragValidationIssue({
	crag,
	current = crag,
	access,
	topo,
	sectorTopos = [],
	has3DTopo = false,
	has2DTopo: currentHas2DTopo,
	images = [],
	cragPath,
	sectorId = null
}) {
	const cragProperties = crag?.properties || crag || {};
	const currentProperties = current?.properties || current || {};
	const sectors = cragProperties.sectors || [];

	if (!hasAccessInformation(access)) return issue('access', cragPath);

	const hasDescription = [
		cragProperties.description_de,
		cragProperties.description_en,
		cragProperties.description
	].some(hasText);
	const type = cragProperties.type;
	if (
		!hasDescription ||
		!(Array.isArray(type) ? type.length : hasText(type)) ||
		!hasValidGeometry(crag?.geometry)
	) {
		return issue('core', cragPath);
	}

	const topoEntries = [
		{ sectorId, topo, has3DTopo, has2DTopo: currentHas2DTopo ?? has2DTopo(topo) },
		...sectorTopos.map((entry) => ({
			sectorId: entry.sectorId,
			topo: entry.topo,
			has3DTopo: entry.has3DTopo,
			has2DTopo: entry.has2DTopo ?? has2DTopo(entry.topo)
		}))
	];
	const uniqueTopos = topoEntries.filter((entry, index, entries) =>
		entry.sectorId
			? entries.findIndex((candidate) => candidate.sectorId === entry.sectorId) === index
			: index === 0
	);

	if (
		(sectorId || sectors.length > 0) &&
		!uniqueTopos.some((entry) => entry.has2DTopo || entry.has3DTopo)
	) {
		return issue('topo', cragPath, sectorId || sectors.find((sector) => sector?.id)?.id);
	}

	for (const entry of uniqueTopos) {
		for (const route of entry.topo?.routes || []) {
			if (
				!hasText(route.name) ||
				!hasText(route.grade) ||
				(!hasRouteLine(route, 'points2D') && !hasRouteLine(route, 'points')) ||
				(routeNeedsProtection(route) && !hasRouteProtection(route, entry.topo))
			) {
				return issue('routes', cragPath, entry.sectorId);
			}
		}
	}

	const hasVisualSubject = uniqueTopos.some(
		(entry) => entry.has2DTopo || entry.has3DTopo || entry.topo?.routes?.length > 0
	);
	if (hasVisualSubject && !images.length && !currentProperties.previewImage) {
		return issue('visual', cragPath, sectorId);
	}

	return null;
}

export function buildFelsstudioUrl(baseUrl, { cragPath, sectorId, task, returnTo }) {
	if (!baseUrl) return null;
	const url = new URL(baseUrl);
	url.searchParams.set('cragPath', cragPath);
	if (sectorId) url.searchParams.set('sectorId', sectorId);
	url.searchParams.set('task', task);
	url.searchParams.set('returnTo', returnTo);
	return url.toString();
}
