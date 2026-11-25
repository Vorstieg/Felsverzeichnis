import { Protocol } from 'pmtiles';

const archiveUrl = 'https://lager.felsverzeichnis.at/api/tiles/via-ferrata.pmtiles';
let registered = false;

/** Register once for all map instances and style changes.
 * @param {Pick<typeof import('maplibre-gl'), 'addProtocol'>} maplibre
 */
export function registerCustomTiles(maplibre) {
	if (registered) return;
	maplibre.addProtocol('pmtiles', new Protocol().tile);
	registered = true;
}

/** Keep static map styles usable while allowing a local Felslager archive.
 * @param {string} url
 * @param {string} tilesUrl
 */
export function transformTileRequest(url, tilesUrl) {
	const prefix = `pmtiles://${archiveUrl}`;
	return { url: url.startsWith(prefix) ? `pmtiles://${tilesUrl}${url.slice(prefix.length)}` : url };
}
