import { describe, expect, it } from 'vitest';
import { Topo } from '$lib/assets/js/topo-paths.js';

describe('Topo paths', () => {
	it('builds crag asset paths', () => {
		const topo = new Topo('lower-austria', 'hohe-wand');
		expect(topo.getTopoPath()).toBe('lower-austria/hohe-wand/hohe-wand-topo.json');
		expect(topo.getCragPath()).toBe('lower-austria/hohe-wand/hohe-wand.json');
		expect(topo.getGlbPath()).toBe('lower-austria/hohe-wand/hohe-wand.glb');
		expect(topo.getAccessPath()).toBe('lower-austria/hohe-wand/hohe-wand-access.json');
		expect(topo.getFolder()).toBe('lower-austria/hohe-wand');
	});

	it('builds sector paths and names', () => {
		const topo = new Topo('lower-austria', 'hohe-wand', 'sektor-nord');
		expect(topo.getCurrentPath()).toBe('lower-austria/hohe-wand/sektor-nord/sektor-nord.json');
		expect(topo.getSectorPath()).toBe('lower-austria/hohe-wand/sektor-nord/sektor-nord.json');
		expect(topo.getFileName()).toBe('sektor-nord.json');
		expect(topo.getGlbName()).toBe('sektor-nord.glb');
		expect(topo.getFolder()).toBe('lower-austria/hohe-wand/sektor-nord/');
	});

	it('creates stable image names from accented filenames', () => {
		const topo = new Topo('a', 'b');
		expect(topo.getImagePath('Nähe zum Fluß.JPG')).toBe('a/b/b-image-nahe-zum-flu.jpg');
		expect(topo.getImagePath('photo', 2)).toBe('a/b/b-image-2-photo');
	});
});
