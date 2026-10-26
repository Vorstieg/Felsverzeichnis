import type { Grade, Route } from '@vorstieg/fels-types/types';

export const viaFerrataOrder = ['A', 'A/B', 'B', 'B/C', 'C', 'C/D', 'D', 'D/E', 'E', 'E/F', 'F'];

export const sacOrder = [
	'F',
	'F+',
	'PD-',
	'PD',
	'PD+',
	'AD-',
	'AD',
	'AD+',
	'D-',
	'D',
	'D+',
	'TD-',
	'TD',
	'TD+',
	'ED-',
	'ED',
	'ED+',
	'ABO'
];

export const fontOrder = [
	'3',
	'3+',
	'4',
	'4+',
	'5',
	'5+',
	'6A',
	'6A+',
	'6B',
	'6B+',
	'6C',
	'6C+',
	'7A',
	'7A+',
	'7B',
	'7B+',
	'7C',
	'7C+',
	'8A',
	'8A+',
	'8B',
	'8B+',
	'8C',
	'8C+'
];

/**
 * Returns the primary grading scale for a climbing discipline.
 */
export function getDisciplineScale(
	climbingType?: string,
	grade?: Partial<NonNullable<Grade>> | null
): 'via-ferrata' | 'sac' | 'font' | 'uiaa' | 'french' {
	const scale = (grade?.scale || '').toLowerCase();
	if (scale === 'via-ferrata' || climbingType === 'via-ferrata') return 'via-ferrata';
	if (scale === 'sac' || climbingType === 'alpine-tour') return 'sac';
	if (climbingType === 'bouldering' || scale === 'font') return 'font';
	if (scale === 'uiaa') return 'uiaa';
	return 'french';
}

export const gradeOrder = [
	'1a',
	'1b',
	'1c',
	'2a',
	'2b',
	'2c',
	'3a',
	'3a+',
	'3b',
	'3b+',
	'3c',
	'3c+',
	'4a',
	'4a+',
	'4b',
	'4b+',
	'4c',
	'4c+',
	'5a',
	'5a+',
	'5b',
	'5b+',
	'5c',
	'5c+',
	'6a',
	'6a+',
	'6b',
	'6b+',
	'6c',
	'6c+',
	'7a',
	'7a+',
	'7b',
	'7b+',
	'7c',
	'7c+',
	'8a',
	'8a+',
	'8b',
	'8b+',
	'8c',
	'8c+',
	'9a',
	'9a+',
	'9b',
	'9b+'
];

export function gradeRank(grade: Grade | undefined, climbingType?: string) {
	if (!grade) return -1;
	const std = (grade.standardizedValue || grade.value || '').trim();
	if (!std) return -1;
	const scale = getDisciplineScale(climbingType, grade);

	if (scale === 'via-ferrata') return viaFerrataOrder.indexOf(std.toUpperCase());
	if (scale === 'sac') {
		const idx = sacOrder.indexOf(std.toUpperCase());
		if (idx >= 0) return idx;
	}
	if (scale === 'font') {
		const clean = std.replace(/^fb\s*/i, '').toUpperCase();
		return fontOrder.indexOf(clean);
	}
	return gradeOrder.indexOf(std.replace(/^fb\s*/i, '').toLowerCase());
}

export function routeGrade(route: Route) {
	if (route.grade) return route.grade;
	const type = route.type;
	return (route.pitches ?? []).reduce<Grade>(
		(hardest, pitch) =>
			gradeRank(pitch.grade, type) > gradeRank(hardest, type) ? (pitch.grade ?? null) : hardest,
		null
	);
}

export function routeLength(route: Route) {
	if (route.length !== undefined) return route.length;
	const lengths = (route.pitches ?? []).flatMap((pitch) => {
		const length: unknown = pitch.length;
		if (length === undefined || length === null || (typeof length === 'string' && !length.trim())) {
			return [];
		}
		const numericLength = Number(length);
		return Number.isFinite(numericLength) ? [numericLength] : [];
	});
	return lengths.length ? lengths.reduce((total, length) => total + length, 0) : null;
}

export function hardestRouteGrade(route: Route, climbingType?: string): Grade {
	const type = climbingType || route?.type;
	return [route.grade, ...(route.pitches ?? []).map((pitch) => pitch.grade)].reduce<Grade>(
		(hardest, grade) =>
			gradeRank(grade, type) > gradeRank(hardest, type) ? (grade ?? null) : hardest,
		null
	);
}
