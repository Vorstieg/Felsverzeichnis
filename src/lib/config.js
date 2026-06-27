import { env } from '$env/dynamic/public';

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

export const types = ['sports-climbing', 'bouldering', 'multi-pitch', 'trad'];

export const securityRatings = new Map([
	['Alpine', 1],
	['Mittel', 2],
	['Gut', 3],
	['Sehr Gut', 4]
]);

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
