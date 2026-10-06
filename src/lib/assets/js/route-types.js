import { routeTypeMeta } from '$lib/config.js';

/** @param {string | undefined} typeId */
export function getRouteTypeMeta(typeId) {
	return (
		(typeId ? routeTypeMeta[typeId] : undefined) || {
			color: '#64748b',
			dotClass: 'bg-slate-500',
			badgeClass: 'bg-slate-500 text-white border-transparent'
		}
	);
}

/** @param {string | undefined} typeId */
export function getTypeColor(typeId) {
	return getRouteTypeMeta(typeId).color;
}

/** @param {string | undefined} typeId */
export function getTypeDotClass(typeId) {
	return getRouteTypeMeta(typeId).dotClass;
}

/** @param {string | undefined} typeId */
export function getTypeBadgeClass(typeId) {
	return getRouteTypeMeta(typeId).badgeClass;
}

/** @param {string | undefined} typeId */
export function getTypeColorClass(typeId) {
	return getTypeBadgeClass(typeId);
}

/** @param {string | undefined} typeId */
export function getTypeSolidBadgeClass(typeId) {
	const meta = getRouteTypeMeta(typeId);
	return `${meta.dotClass} bg-opacity-50 text-white border-transparent`;
}
