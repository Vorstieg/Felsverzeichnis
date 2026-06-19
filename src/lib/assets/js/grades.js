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

export const standardGrades = [];
for (let i = 1; i <= 9; i++) {
	for (let x of ['a', 'b', 'c']) {
		for (let m of ['', '+']) {
			standardGrades.push(i + x + m);
		}
	}
}

export function getGradeLabel(grade, scale) {
	if (scale === 'uiaa') {
		return uiaaMap[grade] || grade;
	}
	return grade;
}
