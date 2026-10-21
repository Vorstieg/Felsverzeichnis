import { describe, expect, it } from 'vitest';
import {
	getGradeColor,
	getGradeDistribution,
	getGradeLabel,
	getGradeTier,
	standardGrades,
	uiaaMap
} from '$lib/assets/js/grades.js';
import { colors } from '$lib/colors.js';

describe('grades', () => {
	it('contains the complete standard grade range', () => {
		expect(standardGrades).toHaveLength(54);
		expect(standardGrades).toContain('1a');
		expect(standardGrades).toContain('9c+');
	});

	it('translates UIAA grades and preserves unknown values', () => {
		expect(getGradeLabel('6a+', 'uiaa')).toBe('VI+');
		expect(getGradeLabel('unknown', 'uiaa')).toBe('unknown');
		expect(getGradeLabel('6a', 'french')).toBe('6a');
		expect(uiaaMap['9a']).toBe('XI+');
	});

	it('returns corresponding colors for standardized grades', () => {
		expect(getGradeColor({ standardizedValue: '4a' })).toBe(colors.topo.gradeEasy);
		expect(getGradeColor({ standardizedValue: '5b' })).toBe(colors.topo.grade5);
		expect(getGradeColor({ standardizedValue: '6b' })).toBe(colors.topo.grade6Low);
		expect(getGradeColor({ standardizedValue: '7a' })).toBe(colors.topo.grade6High7Low);
		expect(getGradeColor({ standardizedValue: '7b+' })).toBe(colors.topo.grade7High);
		expect(getGradeColor({ standardizedValue: '8a' })).toBe(colors.topo.grade8);
		expect(getGradeColor({ standardizedValue: '9a+' })).toBe(colors.topo.grade9);
		expect(getGradeColor(undefined)).toBe(colors.topo.gradeUnknown);
	});

	it('classifies grades into unified tiers', () => {
		expect(getGradeTier({ standardizedValue: '3c' })?.key).toBe('under_5');
		expect(getGradeTier({ standardizedValue: '5a' })?.key).toBe('5');
		expect(getGradeTier({ standardizedValue: '6a+' })?.key).toBe('6_low');
		expect(getGradeTier({ standardizedValue: '6c+' })?.key).toBe('6_high_7_low');
		expect(getGradeTier({ standardizedValue: '7c' })?.key).toBe('7_high');
		expect(getGradeTier({ standardizedValue: '8b' })?.key).toBe('8');
		expect(getGradeTier({ standardizedValue: '9b+' })?.key).toBe('9');
		expect(getGradeTier(null)).toBeNull();
	});

	it('calculates consistent grade distribution across routes', () => {
		const routes = [
			{ id: '1', grade: { standardizedValue: '4c' } },
			{ id: '2', grade: { standardizedValue: '5b' } },
			{ id: '3', grade: { standardizedValue: '6b' } },
			{ id: '4', grade: { standardizedValue: '7a' } },
			{ id: '5', grade: { standardizedValue: '7b+' } },
			{ id: '6', grade: { standardizedValue: '8a+' } },
			{ id: '7', grade: { standardizedValue: '9a' } },
			{ id: '8', grade: null }
		];

		const distribution = getGradeDistribution(routes);
		expect(distribution).toHaveLength(8);
		expect(distribution.reduce((acc, d) => acc + d.count, 0)).toBe(8);
		expect(distribution.reduce((acc, d) => acc + d.percent, 0)).toBeCloseTo(100);

		const under5 = distribution.find((d) => d.key === 'under_5');
		expect(under5?.color).toBe(colors.topo.gradeEasy);
		expect(under5?.count).toBe(1);

		const tier9 = distribution.find((d) => d.key === '9');
		expect(tier9?.color).toBe(colors.topo.grade9);
		expect(tier9?.count).toBe(1);

		const unknown = distribution.find((d) => d.key === 'unknown');
		expect(unknown?.color).toBe(colors.topo.gradeUnknown);
		expect(unknown?.count).toBe(1);
	});
});
