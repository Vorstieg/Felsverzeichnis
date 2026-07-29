function slugifyName(value) {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Builds the paths for a crag and its optional sector assets.
 * `path` is the directory containing the crag directory.
 */
export class Topo {
	constructor(path, cragId, sectorId) {
		this.path = path;
		this.cragId = cragId;
		this.sectorId = sectorId;
	}

	_getPath() {
		return this.sectorId
			? `${this.path}/${this.cragId}/${this.sectorId}/${this.sectorId}`
			: `${this.path}/${this.cragId}/${this.cragId}`;
	}

	getTopoPath() {
		return `${this._getPath()}-topo.json`;
	}

	getCurrentPath() {
		return `${this._getPath()}.json`;
	}

	getGlbPath() {
		return `${this._getPath()}.glb`;
	}

	getGlbName() {
		return `${this.getBaseName()}.glb`;
	}

	_getCragPath() {
		return `${this.path}/${this.cragId}/${this.cragId}`;
	}

	getCragPath() {
		return `${this._getCragPath()}.json`;
	}

	getSectorPath() {
		if (!this.sectorId) return this.getCragPath();
		return `${this.path}/${this.cragId}/${this.sectorId}/${this.getFileName()}`;
	}

	getBaseName() {
		return this.sectorId || this.cragId;
	}

	getFolder() {
		return this.sectorId
			? `${this.path}/${this.cragId}/${this.sectorId}/`
			: `${this.path}/${this.cragId}`;
	}

	getFileName() {
		return `${this.getBaseName()}.json`;
	}

	getAccessPath() {
		return `${this._getCragPath()}-access.json`;
	}

	getImagePath(name, index = 0) {
		const lastDot = name.lastIndexOf('.');
		const ext = lastDot > 0 ? name.substring(lastDot).toLowerCase() : '';
		const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
		const slug = slugifyName(baseName) || 'img';
		return `${this._getPath()}-image${index > 0 ? `-${index}` : ''}-${slug}${ext}`;
	}
}
