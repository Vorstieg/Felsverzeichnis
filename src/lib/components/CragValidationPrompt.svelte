<script>
import { browser } from '$app/environment';
import { _ } from 'svelte-i18n';
import { buildFelsstudioUrl } from '$lib/assets/js/crag-validation.js';

let { issue, editorUrl = '', returnTo = '' } = $props();
let dismissed = $state(false);
const maxAge = 30 * 24 * 60 * 60 * 1000;
let storageKey = $derived(
	issue ? `fels-validation-dismissal:${issue.target.cragPath}:${issue.rule}` : ''
);
let href = $derived(
	issue && editorUrl
		? buildFelsstudioUrl(editorUrl, { ...issue.target, task: issue.task, returnTo })
		: null
);

$effect(() => {
	if (!browser || !issue) return;
	try {
		const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
		dismissed = Boolean(value?.expiresAt > Date.now());
	} catch {
		dismissed = false;
	}
});

function dismiss() {
	dismissed = true;
	if (!browser) return;
	try {
		localStorage.setItem(storageKey, JSON.stringify({ expiresAt: Date.now() + maxAge }));
	} catch {
		// A private-browser storage failure should not prevent hiding the prompt.
	}
}
</script>

{#if issue && !dismissed}
	<aside
		class="not-prose mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
		aria-label={$_('validation.title')}
	>
		<div class="flex items-start gap-3">
			<i class="fa-solid fa-wand-magic-sparkles mt-0.5 text-amber-600"></i>
			<div class="min-w-0 flex-1">
				<p class="m-0 font-semibold">{$_('validation.title')}</p>
				<p class="mt-1 mb-3">{$_(issue.copyKey)}</p>
				{#if href}
					<a
						class="font-semibold text-amber-900 underline hover:text-amber-700"
						href={href}
						target="_blank"
						rel="noopener"
					>
						{$_('validation.improve')}
						<i class="fa-solid fa-arrow-up-right-from-square ml-1 text-xs"></i>
					</a>
				{/if}
			</div>
			<button
				type="button"
				class="text-amber-700 hover:text-amber-950"
				onclick={dismiss}
				aria-label={$_('validation.dismiss')}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	</aside>
{/if}
