import { error } from '@sveltejs/kit';
import { base } from '$app/paths';

// Ensures all pages under this layout (which is all of them) are statically prerendered at build time
export const prerender = true;

// Allows client side routing. Necessary for page transitions and link prefetching; change to false if you prefer ordinary routing without JS
export const csr = true;

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
