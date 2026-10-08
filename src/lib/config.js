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
export const siteLink = 'https://www.felsverzeichnis.at/';
export const fsApiUrl = env.PUBLIC_FS_API_URL || 'https://lager.felsverzeichnis.at/api/fs';
export const felsstudioUrl = env.PUBLIC_FELSSTUDIO_URL || '';

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

/** @type {Record<string, {color: string, dotClass: string, badgeClass: string}>} */
export const routeTypeMeta = {
	'sports-climbing': {
		color: colors.routeTypes['sports-climbing'],
		dotClass: 'bg-blue-500',
		badgeClass: 'bg-blue-500 text-white border-transparent'
	},
	bouldering: {
		color: colors.routeTypes.bouldering,
		dotClass: 'bg-orange-500',
		badgeClass: 'bg-orange-500 text-white border-transparent'
	},
	'multi-pitch': {
		color: colors.routeTypes['multi-pitch'],
		dotClass: 'bg-emerald-500',
		badgeClass: 'bg-emerald-500 text-white border-transparent'
	},
	trad: {
		color: colors.routeTypes.trad,
		dotClass: 'bg-red-500',
		badgeClass: 'bg-red-500 text-white border-transparent'
	},
	'alpine-tour': {
		color: colors.routeTypes['alpine-tour'],
		dotClass: 'bg-violet-500',
		badgeClass: 'bg-violet-500 text-white border-transparent'
	},
	'via-ferrata': {
		color: colors.routeTypes['via-ferrata'],
		dotClass: 'bg-pink-500',
		badgeClass: 'bg-pink-500 text-white border-transparent'
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
