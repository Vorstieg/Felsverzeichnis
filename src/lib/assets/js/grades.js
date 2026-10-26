import { colors } from '$lib/colors.js';
import {
	fontOrder,
	getDisciplineScale,
	gradeOrder,
	hardestRouteGrade,
	sacOrder,
	viaFerrataOrder
} from '$lib/assets/js/route-summary';

export { fontOrder, getDisciplineScale, gradeOrder, sacOrder, viaFerrataOrder };

/** @type {Record<string, string>} */
export const uiaaMap = {
	'1a': 'I',
	'2a': 'II',
	'3a': 'III',
	'4a': 'IV',
	'4b': 'IV+',
	'4c': 'V-',
	'5a': 'V',
	'5b': 'V+',
	'5c': 'VI-',
	'6a': 'VI',
	'6a+': 'VI+',
	'6b': 'VII-',
	'6b+': 'VII',
	'6c': 'VII+',
	'6c+': 'VIII-',
	'7a': 'VIII',
	'7a+': 'VIII+',
	'7b': 'IX-',
	'7b+': 'IX',
	'7c': 'IX+',
	'7c+': 'X-',
	'8a': 'X',
	'8a+': 'X+',
	'8b': 'XI-',
	'8b+': 'XI',
	'9a': 'XI+'
};

/** @type {string[]} */
export const standardGrades = [];
for (let i = 1; i <= 9; i++) {
	for (let x of ['a', 'b', 'c']) {
		for (let m of ['', '+']) {
			standardGrades.push(i + x + m);
		}
	}
}

/**
 * Returns the ordered list of grades for a climbing discipline.
 * @param {string | undefined} climbingType
 * @returns {string[]}
 */
export function getGradeScaleOrder(climbingType) {
	if (climbingType === 'via-ferrata') return viaFerrataOrder;
	if (climbingType === 'alpine-tour') return sacOrder;
	if (climbingType === 'bouldering') return fontOrder;
	return gradeOrder;
}

/**
 * Returns discipline-appropriate quick filter chips for search.
 * @param {string | null | undefined} climbingType
 * @returns {Array<{ label: string, min?: string, max?: string }>}
 */
export function getDisciplineQuickFilters(climbingType) {
	if (climbingType === 'via-ferrata') {
		return [
			{ label: 'A', min: 'A', max: 'A' },
			{ label: 'B', min: 'A/B', max: 'B' },
			{ label: 'C', min: 'B/C', max: 'C' },
			{ label: 'D', min: 'C/D', max: 'D' },
			{ label: 'E+', min: 'D/E', max: undefined }
		];
	}
	if (climbingType === 'bouldering') {
		return [
			{ label: '< Fb 5', min: undefined, max: '4+' },
			{ label: 'Fb 5 - 5+', min: '5', max: '5+' },
			{ label: 'Fb 6A - 6B+', min: '6A', max: '6B+' },
			{ label: 'Fb 6C - 7A+', min: '6C', max: '7A+' },
			{ label: 'Fb 7B - 8A', min: '7B', max: '8A' },
			{ label: '≥ Fb 8A+', min: '8A+', max: undefined }
		];
	}
	if (climbingType === 'alpine-tour') {
		return [
			{ label: 'F - PD', min: 'F', max: 'PD+' },
			{ label: 'AD', min: 'AD-', max: 'AD+' },
			{ label: 'D', min: 'D-', max: 'D+' },
			{ label: 'TD', min: 'TD-', max: 'TD+' },
			{ label: '≥ ED', min: 'ED-', max: undefined }
		];
	}
	// Sport, multi-pitch, trad or generic rock
	return [
		{ label: '< 5a', min: undefined, max: '4c+' },
		{ label: '5a - 5c+', min: '5a', max: '5c+' },
		{ label: '6a - 6b+', min: '6a', max: '6b+' },
		{ label: '6c - 7a+', min: '6c', max: '7a+' },
		{ label: '7b - 8a+', min: '7b', max: '8a+' },
		{ label: '≥ 8b', min: '8b', max: undefined }
	];
}

/**
 * Returns formatted display text for a grade.
 * @param {string | undefined} grade
 * @param {string | undefined} [scale]
 * @param {string | undefined} [climbingType]
 */
export function getGradeLabel(grade, scale, climbingType) {
	if (!grade) return '';
	const s = (scale || '').toLowerCase();
	if (s === 'via-ferrata' || climbingType === 'via-ferrata') return grade;
	if (s === 'sac' || climbingType === 'alpine-tour') return grade;
	if (climbingType === 'bouldering' || s === 'font') {
		return grade.startsWith('Fb ') || grade.startsWith('fb ') ? grade : `Fb ${grade}`;
	}
	if (s === 'uiaa') {
		return uiaaMap[grade] || grade;
	}
	return grade;
}

/**
 * Grade tier classification for consistent colors across the app.
 * Returns distinct color tiers across each climbing discipline's grading spectrum.
 * @param {Partial<import('@vorstieg/fels-types/types').Grade> | undefined | null} grade
 * @param {string | undefined} [climbingType]
 */
export function getGradeTier(grade, climbingType) {
	const val = (grade?.standardizedValue || grade?.value || '').trim();
	if (!val) return null;
	const scale = getDisciplineScale(climbingType, grade);

	if (scale === 'via-ferrata') {
		const u = val.toUpperCase();
		if (u === 'A') return { key: 'under_5', label: 'A', color: colors.topo.gradeEasy };
		if (u === 'A/B' || u === 'B') return { key: '5', label: 'B', color: colors.topo.grade5 };
		if (u === 'B/C' || u === 'C') return { key: '6_low', label: 'C', color: colors.topo.grade6Low };
		if (u === 'C/D' || u === 'D')
			return { key: '6_high_7_low', label: 'D', color: colors.topo.grade6High7Low };
		if (u === 'D/E' || u === 'E')
			return { key: '7_high', label: 'E', color: colors.topo.grade7High };
		if (u === 'E/F' || u === 'F') return { key: '8', label: 'F', color: colors.topo.grade8 };
	}

	if (scale === 'sac') {
		const u = val.toUpperCase();
		if (u.startsWith('F') || u.startsWith('PD'))
			return { key: 'under_5', label: 'F - PD', color: colors.topo.gradeEasy };
		if (u.startsWith('AD')) return { key: '5', label: 'AD', color: colors.topo.grade5 };
		if (u.startsWith('D')) return { key: '6_low', label: 'D', color: colors.topo.grade6Low };
		if (u.startsWith('TD'))
			return { key: '6_high_7_low', label: 'TD', color: colors.topo.grade6High7Low };
		if (u.startsWith('ED')) return { key: '7_high', label: 'ED', color: colors.topo.grade7High };
		if (u === 'ABO') return { key: '8', label: 'ABO', color: colors.topo.grade8 };
	}

	if (scale === 'font') {
		const clean = val.replace(/^fb\s*/i, '').toUpperCase();
		if (['3', '3+', '4', '4+'].includes(clean))
			return { key: 'under_5', label: '< Fb 5', color: colors.topo.gradeEasy };
		if (['5', '5+'].includes(clean))
			return { key: '5', label: 'Fb 5 - 5+', color: colors.topo.grade5 };
		if (['6A', '6A+', '6B', '6B+'].includes(clean))
			return { key: '6_low', label: 'Fb 6A - 6B+', color: colors.topo.grade6Low };
		if (['6C', '6C+', '7A', '7A+'].includes(clean))
			return { key: '6_high_7_low', label: 'Fb 6C - 7A+', color: colors.topo.grade6High7Low };
		if (['7B', '7B+', '7C', '7C+', '8A'].includes(clean))
			return { key: '7_high', label: 'Fb 7B - 8A', color: colors.topo.grade7High };
		if (['8A+', '8B', '8B+', '8C', '8C+'].includes(clean))
			return { key: '8', label: '≥ Fb 8A+', color: colors.topo.grade8 };
	}

	// UIAA roman numerals
	const u = val.toUpperCase();
	if (['I', 'II', 'III', 'IV-', 'IV'].includes(u))
		return { key: 'under_5', label: '< V', color: colors.topo.gradeEasy };
	if (['IV+', 'V-', 'V', 'V+'].includes(u))
		return { key: '5', label: 'V - VI-', color: colors.topo.grade5 };
	if (['VI-', 'VI', 'VI+'].includes(u))
		return { key: '6_low', label: 'VI - VII-', color: colors.topo.grade6Low };
	if (['VII-', 'VII', 'VII+'].includes(u))
		return { key: '6_high_7_low', label: 'VII - VIII-', color: colors.topo.grade6High7Low };
	if (['VIII-', 'VIII', 'VIII+'].includes(u))
		return { key: '7_high', label: 'VIII - IX+', color: colors.topo.grade7High };
	if (['IX-', 'IX', 'IX+', 'X-', 'X', 'X+', 'XI-', 'XI', 'XI+'].includes(u))
		return { key: '8', label: '≥ X-', color: colors.topo.grade8 };

	// French rock grades
	const g = val
		.replace(/^fb\s*/i, '')
		.trim()
		.toLowerCase();
	if (g.startsWith('1') || g.startsWith('2') || g.startsWith('3') || g.startsWith('4')) {
		return { key: 'under_5', label: '< 5a', color: colors.topo.gradeEasy };
	}
	if (g.startsWith('5')) {
		return { key: '5', label: '5a - 5c+', color: colors.topo.grade5 };
	}
	if (g.startsWith('6a') || g.startsWith('6b')) {
		return { key: '6_low', label: '6a - 6b+', color: colors.topo.grade6Low };
	}
	if (g.startsWith('6c') || g.startsWith('7a')) {
		return { key: '6_high_7_low', label: '6c - 7a+', color: colors.topo.grade6High7Low };
	}
	if (g.startsWith('7b') || g.startsWith('7c')) {
		return { key: '7_high', label: '7b - 7c+', color: colors.topo.grade7High };
	}
	if (g.startsWith('8')) {
		return { key: '8', label: '8a - 8c+', color: colors.topo.grade8 };
	}
	if (g.startsWith('9')) {
		return { key: '9', label: '≥ 9a', color: colors.topo.grade9 };
	}
	if (g.startsWith('6')) return { key: '6_low', label: '6a - 6b+', color: colors.topo.grade6Low };
	if (g.startsWith('7')) return { key: '7_high', label: '7b - 7c+', color: colors.topo.grade7High };
	return null;
}

/**
 * @param {Partial<import('@vorstieg/fels-types/types').Grade> | undefined | null} grade
 * @param {string | undefined} [climbingType]
 */
export function getGradeColor(grade, climbingType) {
	const tier = getGradeTier(grade, climbingType);
	return tier ? tier.color : colors.topo.gradeUnknown;
}

/**
 * Returns the grade distribution across discipline-appropriate tiers for a list of routes.
 * @param {import('@vorstieg/fels-types/types').Route[] | undefined | null} routes
 * @param {string | undefined} [climbingType]
 * @returns {Array<{ key: string, count: number, percent: number, color: string, label: string }>}
 */
export function getGradeDistribution(routes, climbingType) {
	if (!routes || routes.length === 0) return [];

	/** @type {Record<string, { count: number, color: string, label: string }>} */
	const counts = {};

	routes.forEach((r) => {
		const type = climbingType || r.type;
		const grade = hardestRouteGrade(r, type) ?? r.grade;
		const tier = getGradeTier(grade, type);
		if (tier) {
			if (!counts[tier.key]) {
				counts[tier.key] = { count: 0, color: tier.color, label: tier.label };
			}
			counts[tier.key].count++;
		} else {
			if (!counts.unknown) {
				counts.unknown = { count: 0, color: colors.topo.gradeUnknown, label: '?' };
			}
			counts.unknown.count++;
		}
	});

	const total = Object.values(counts).reduce((sum, item) => sum + item.count, 0);
	if (total === 0) return [];

	const order = ['under_5', '5', '6_low', '6_high_7_low', '7_high', '8', '9', 'unknown'];
	return order
		.filter((k) => counts[k] && counts[k].count > 0)
		.map((key) => {
			const item = counts[key];
			return {
				key,
				count: item.count,
				percent: (item.count / total) * 100,
				color: item.color,
				label: item.label
			};
		});
}
