import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import felsSchema from '@vorstieg/fels-types/schemas/fels';
import topoSchema from '@vorstieg/fels-types/schemas/topo';

const validate = new Ajv({ allErrors: true, schemas: [felsSchema] }).compile(topoSchema);
const topo = {
	routes: [
		{
			id: 'route',
			points3D: [
				[0, 0, 0],
				[1, 2, 3]
			],
			orientation3D: [0, 0, 1],
			pitches: [
				{
					id: 'pitch',
					pitchNumber: 1,
					points3D: [
						[1, 2, 3],
						[4, 5, 6]
					]
				}
			],
			variants: [
				{
					id: 'variant',
					points3D: [
						[0, 0, 0],
						[2, 3, 4]
					]
				}
			]
		}
	],
	fixPoints: [{ id: 'anchor', type: 'anchor', position3D: [1, 2, 3] }],
	textLabels: [{ id: 'label', text: 'Summit', position3D: [4, 5, 6] }]
};

describe('canonical 3D geometry contract', () => {
	it('validates route, pitch, variant, fix-point and label geometry', () => {
		expect(validate(topo)).toBe(true);
	});
	it.each([
		[
			'route points',
			(data) => {
				data.routes[0].points3D = [[0, 0]];
			}
		],
		[
			'pitch points',
			(data) => {
				data.routes[0].pitches[0].points3D = [
					[0, 0],
					[1, 1]
				];
			}
		],
		[
			'variant points',
			(data) => {
				data.routes[0].variants[0].points3D = [
					[0, 0],
					[1, 1]
				];
			}
		],
		[
			'orientation',
			(data) => {
				data.routes[0].orientation3D = [0, 1];
			}
		],
		[
			'fix-point position',
			(data) => {
				data.fixPoints[0].position3D = [0, 1];
			}
		],
		[
			'label position',
			(data) => {
				data.textLabels[0].position3D = [0, 1];
			}
		]
	])('rejects invalid %s coordinates', (_name, modify) => {
		const invalid = structuredClone(topo);
		modify(invalid);
		expect(validate(invalid)).toBe(false);
	});
});
