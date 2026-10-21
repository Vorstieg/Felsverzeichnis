import { colors } from '$lib/colors.js';
import { hardestRouteGrade } from '$lib/assets/js/route-summary';

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

/** @param {string} grade
 * @param {string} scale */
export function getGradeLabel(grade, scale) {
	if (scale === 'uiaa') {
		return uiaaMap[grade] || grade;
	}
	return grade;
}

/** @param {import('@vorstieg/fels-types/types').Grade | undefined | null} grade */
/**
 * Grade tier classification for consistent colors across the app.
 * Returns at least 7 distinct color tiers across the climbing grade spectrum.
 * @param {Partial<import('@vorstieg/fels-types/types').Grade> | undefined | null} grade
 */
export function getGradeTier(grade) {
	if (!grade?.standardizedValue) return null;
	const g = grade.standardizedValue.replace(/^fb\s*/i, '').trim().toLowerCase();
	if (!g) return null;

	if (
		g.startsWith('1') ||
		g.startsWith('2') ||
		g.startsWith('3') ||
		g.startsWith('4')
	) {
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

/** @param {Partial<import('@vorstieg/fels-types/types').Grade> | undefined | null} grade */
export function getGradeColor(grade) {
	const tier = getGradeTier(grade);
	return tier ? tier.color : colors.topo.gradeUnknown;
}

/**
 * Returns the grade distribution across the unified tiers for a list of routes.
 * @param {import('@vorstieg/fels-types/types').Route[] | undefined | null} routes
 * @returns {Array<{ key: string, count: number, percent: number, color: string, label: string }>}
 */
export function getGradeDistribution(routes) {
	if (!routes || routes.length === 0) return [];

	/** @type {Record<string, { count: number, color: string, label: string }>} */
	const counts = {
		under_5: { count: 0, color: colors.topo.gradeEasy, label: '< 5a' },
		'5': { count: 0, color: colors.topo.grade5, label: '5a - 5c+' },
		'6_low': { count: 0, color: colors.topo.grade6Low, label: '6a - 6b+' },
		'6_high_7_low': { count: 0, color: colors.topo.grade6High7Low, label: '6c - 7a+' },
		'7_high': { count: 0, color: colors.topo.grade7High, label: '7b - 7c+' },
		'8': { count: 0, color: colors.topo.grade8, label: '8a - 8c+' },
		'9': { count: 0, color: colors.topo.grade9, label: '≥ 9a' },
		unknown: { count: 0, color: colors.topo.gradeUnknown, label: '?' }
	};

	routes.forEach((r) => {
		const grade = hardestRouteGrade(r) ?? r.grade;
		const tier = getGradeTier(grade);
		if (tier) {
			counts[tier.key].count++;
		} else {
			counts.unknown.count++;
		}
	});

	const total = Object.values(counts).reduce((sum, item) => sum + item.count, 0);
	if (total === 0) return [];

	const order = ['under_5', '5', '6_low', '6_high_7_low', '7_high', '8', '9', 'unknown'];
	return order
		.map((key) => {
			const item = counts[key];
			return {
				key,
				count: item.count,
				percent: (item.count / total) * 100,
				color: item.color,
				label: item.label
			};
		})
		.filter((s) => s.count > 0);
}
