import type { Grade, Route } from '@vorstieg/fels-types/types';

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

export function gradeRank(grade: Grade | undefined) {
	return grade ? gradeOrder.indexOf(grade.standardizedValue) : -1;
}

export function routeGrade(route: Route) {
	if (route.grade) return route.grade;
	return (route.pitches ?? []).reduce<Grade>(
		(hardest, pitch) =>
			gradeRank(pitch.grade) > gradeRank(hardest) ? (pitch.grade ?? null) : hardest,
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

export function hardestRouteGrade(route: Route): Grade {
	return [route.grade, ...(route.pitches ?? []).map((pitch) => pitch.grade)].reduce<Grade>(
		(hardest, grade) => (gradeRank(grade) > gradeRank(hardest) ? (grade ?? null) : hardest),
		null
	);
}
