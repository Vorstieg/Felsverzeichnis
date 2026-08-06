import { env } from '$env/dynamic/public';
import { colors } from '$lib/colors.js';

/**
 * All of these values are used throughout the site – for example,
 * in the <meta> tags, in the footer, and in the RSS feed.
 *
 * PLEASE BE SURE TO UPDATE THEM ALL! Thank you!
 **/

export const siteTitle = 'Klettergebiete rund um Wien';
export const siteDescription = 'Finde Klettergebiete die von Wien aus öffentlich erreichbar sind';
export const siteLink = 'https://felsverzeichnis.vorstieg.eu/';
export const fsApiUrl = env.PUBLIC_FS_API_URL || 'https://felslager.vorstieg.eu/api/fs';

// Controls how many posts are shown per page on the main blog index pages
export const cragsPerPage = 50;

export const types = [
	'sports-climbing',
	'bouldering',
	'multi-pitch',
	'trad',
	'alpine-tour',
	'via-ferrata'
];

export const geometryModes = ['topo', 'track', 'hybrid'];

export const gpxRoles = ['main', 'approach', 'descent', 'variant'];

export const routeTypeMeta = {
	'sports-climbing': {
		color: colors.routeTypes['sports-climbing'],
		dotClass: 'bg-blue-500',
		badgeClass: 'bg-blue-100 text-blue-700 border-blue-200'
	},
	bouldering: {
		color: colors.routeTypes.bouldering,
		dotClass: 'bg-orange-500',
		badgeClass: 'bg-orange-100 text-orange-700 border-orange-200'
	},
	'multi-pitch': {
		color: colors.routeTypes['multi-pitch'],
		dotClass: 'bg-emerald-500',
		badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
	},
	trad: {
		color: colors.routeTypes.trad,
		dotClass: 'bg-yellow-500',
		badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200'
	},
	'alpine-tour': {
		color: colors.routeTypes['alpine-tour'],
		dotClass: 'bg-violet-500',
		badgeClass: 'bg-violet-100 text-violet-700 border-violet-200'
	},
	'via-ferrata': {
		color: colors.routeTypes['via-ferrata'],
		dotClass: 'bg-pink-500',
		badgeClass: 'bg-pink-100 text-pink-700 border-pink-200'
	}
};

export const securityRatings = new Map([
	['Alpine', 1],
	['Mittel', 2],
	['Gut', 3],
	['Sehr Gut', 4]
]);

export const alpineRouteTags = [
	'Hochtour',
	'Klettersteig',
	'Gletscherwanderung',
	'Schneefeld',
	'Gratwanderung',
	'Abstieg',
	'Zustieg',
	'Gipfelsturm',
	'Seen',
	'Unterkunft',
	'Almhütte',
	'Biwak',
	'Einstieg',
	'Ausstieg',
	'Brücke',
	'Leiter',
	'Drahtseil',
	'Wandflucht'
];

export const rockTypes = [
	'granite',
	'gneiss',
	'limestone',
	'dolomite',
	'sandstone',
	'basalt',
	'tuff',
	'rhyolite',
	'quartzite',
	'conglomerate',
	'schist',
	'slate'
];
