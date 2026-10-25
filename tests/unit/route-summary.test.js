import { describe, expect, it } from 'vitest';
import {
	gradeRank,
	hardestRouteGrade,
	routeGrade,
	routeLength
} from '$lib/assets/js/route-summary';

const easy = { scale: 'french', value: '5a', standardizedValue: '5a' };
const hard = { scale: 'french', value: '6b', standardizedValue: '6b' };

describe('canonical route summaries', () => {
	it('keeps the table grade while the chart uses the hardest pitch', () => {
		const route = { id: 0, grade: easy, pitches: [{ id: 1, pitchNumber: 1, grade: hard }] };
		expect(routeGrade(route)).toEqual(easy);
		expect(hardestRouteGrade(route)).toEqual(hard);
	});
	it('supports discipline-aware grade ranking', () => {
		expect(gradeRank({ standardizedValue: 'C/D' }, 'via-ferrata')).toBe(5);
		expect(gradeRank({ standardizedValue: 'A' }, 'via-ferrata')).toBe(0);
		expect(gradeRank({ standardizedValue: 'AD' }, 'alpine-tour')).toBe(6);
		expect(gradeRank({ standardizedValue: '6A' }, 'bouldering')).toBe(6);

		const ferrataRoute = {
			id: 'vf',
			type: 'via-ferrata',
			pitches: [
				{ id: 1, pitchNumber: 1, grade: { standardizedValue: 'B' } },
				{ id: 2, pitchNumber: 2, grade: { standardizedValue: 'D' } }
			]
		};
		expect(hardestRouteGrade(ferrataRoute)?.standardizedValue).toBe('D');
	});
	it('derives missing route grades from structured pitch grades', () => {
		expect(
			routeGrade({
				id: 0,
				pitches: [
					{ id: 1, pitchNumber: 1, grade: easy },
					{ id: 2, pitchNumber: 2, grade: hard }
				]
			})
		).toEqual(hard);
		expect(routeGrade({ id: 0 })).toBeNull();
	});
	it('uses explicit numeric lengths and sums available pitch lengths', () => {
		expect(
			routeLength({ id: 0, length: 0, pitches: [{ id: 1, pitchNumber: 1, length: 20 }] })
		).toBe(0);
		expect(
			routeLength({
				id: 0,
				pitches: [
					{ id: 1, pitchNumber: 1, length: 20 },
					{ id: 2, pitchNumber: 2, length: 30 },
					{ id: 3, pitchNumber: 3 }
				]
			})
		).toBe(50);
		expect(routeLength({ id: 0 })).toBeNull();
	});
});
