/** @param {string} value */
function slugifyName(value) {
	return value
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
	/** @param {string} path
	 * @param {string} cragId
	 * @param {string | null} [sectorId] */
	constructor(path, cragId, sectorId = null) {
		this.path = path;
		this.cragId = cragId;
		this.sectorId = sectorId;
	}

	_getPath() {
		const cragFolder = this.path ? `${this.path}/${this.cragId}` : this.cragId;
		return this.sectorId
			? `${cragFolder}/${this.sectorId}/${this.sectorId}`
			: `${cragFolder}/${this.cragId}`;
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
		return `${this.path ? `${this.path}/` : ''}${this.cragId}/${this.cragId}`;
	}

	getCragPath() {
		return `${this._getCragPath()}.json`;
	}

	getSectorPath() {
		if (!this.sectorId) return this.getCragPath();
		return this.getCurrentPath();
	}

	getBaseName() {
		return this.sectorId || this.cragId;
	}

	getFolder() {
		const cragFolder = this.path ? `${this.path}/${this.cragId}` : this.cragId;
		return this.sectorId ? `${cragFolder}/${this.sectorId}/` : cragFolder;
	}

	getFileName() {
		return `${this.getBaseName()}.json`;
	}

	getAccessPath() {
		return `${this._getCragPath()}-access.json`;
	}

	/** @param {string} name */
	getImagePath(name, index = 0) {
		const lastDot = name.lastIndexOf('.');
		const ext = lastDot > 0 ? name.substring(lastDot).toLowerCase() : '';
		const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
		const slug = slugifyName(baseName) || 'img';
		return `${this._getPath()}-image${index > 0 ? `-${index}` : ''}-${slug}${ext}`;
	}
}
