import { error } from '@sveltejs/kit';
import { base } from '$app/paths';

// Allows client side routing. Necessary for page transitions and link prefetching; change to false if you prefer ordinary routing without JS
export const csr = true;
export const ssr = false;

console.log("=== LAYOUT LOADED ===");
import { browser } from '$app/environment';
import { init, addMessages, getLocaleFromNavigator } from 'svelte-i18n';
import en from '$lib/i18n/locales/en.json';
import de from '$lib/i18n/locales/de.json';

addMessages('en', en);
addMessages('de', de);

init({
	fallbackLocale: 'de',
	initialLocale: browser ? getLocaleFromNavigator() : 'de'
});

export const load = async ({ url }) => {
	try {
		return {
			path: url.pathname,
			meta: {
				lang: "de",
				type: "website",
				title: "Felsverzeichnis",
				description: "Diese Plattform bietet eine Sammlung von Klettergebieten mit detaillierten Informationen zur öffentlichen Anreise." +
					"Egal ob Anfänger*in oder erfahrene*r Kletterer*in – hier findest du passende Felsen für dein nächstes Abenteuer.",
				author: "Vorstieg Software FlexCo",
				url: url.href
			}
		};
	} catch (err) {
		error(500, err);
	}
};
