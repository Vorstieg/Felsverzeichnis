import { describe, expect, it } from 'vitest';
import { getGradeLabel, standardGrades, uiaaMap } from '$lib/assets/js/grades.js';

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
});
