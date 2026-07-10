import { routeTypeMeta } from '$lib/config.js';

export function getRouteTypeMeta(typeId) {
	return routeTypeMeta[typeId] || routeTypeMeta['sports-climbing'];
}

export function getTypeColor(typeId) {
	return getRouteTypeMeta(typeId).color;
}

export function getTypeDotClass(typeId) {
	return getRouteTypeMeta(typeId).dotClass;
}

export function getTypeBadgeClass(typeId) {
	return getRouteTypeMeta(typeId).badgeClass;
}

export function getTypeColorClass(typeId) {
	return getTypeBadgeClass(typeId);
}

export function normalizeTypes(type) {
	if (!type) return [];
	if (Array.isArray(type)) return type;
	if (typeof type === 'string') {
		return type
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}
	return [];
}