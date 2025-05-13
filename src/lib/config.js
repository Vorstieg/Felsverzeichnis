/**
 * All of these values are used throughout the site – for example,
 * in the <meta> tags, in the footer, and in the RSS feed.
 *
 * PLEASE BE SURE TO UPDATE THEM ALL! Thank you!
 **/

export const siteTitle = 'Klettergebiete rund um Wien';
export const siteDescription = 'Finde Klettergebiete die von Wien aus öffentlich erreichbar sind';
export const siteLink = 'https://felsverzeichnis.vorstieg.eu/';

// Controls how many posts are shown per page on the main blog index pages
export const cragsPerPage = 50;
export const types = new Map([
	["sports-climbing", "Sportklettern"],
	["bouldering", "Bouldern"],
	["multi-pitch", "Mehrseillängen"],
	["trad", "Traditionell"],
]);

export const rockTypes = new Map([
	["granite", "Granit"],
	["gneiss", "Gneis"],
	["limestone", "Kalkstein"],
	["dolomite", "Dolomit"],
	["sandstone", "Sandstein"],
	["basalt", "Basalt"],
	["tuff", "Tuff"],
	["rhyolite", "Rhyolith"],
	["quartzite", "Quarzit"],
	["conglomerate", "Konglomerat"],
	["schist", "Schiefer"],
	["slate", "Schiefer"]
]);