<script lang="ts">
	import { base } from '$app/paths';
	import { locale } from 'svelte-i18n';

	let {
		crags = [],
		isCompact = false
	}: { crags?: import('$lib/types/files').FelsLocation[]; isCompact?: boolean } = $props();
</script>

{#if isCompact}
	<div class="mt-2 flex flex-col gap-3 pb-10">
		{#each crags as crag}
			<a href="{base}/map/crag/{crag.path}">
				<div
					class="flex cursor-pointer items-center gap-4 border-b border-gray-100 pb-3 transition-colors hover:bg-gray-50"
				>
					<div class="flex-1 overflow-hidden">
						<h5 class="mb-1 truncate text-base font-bold text-gray-900">
							{crag.entry.properties.name}
						</h5>
					</div>
				</div>
			</a>
		{/each}
	</div>
{:else}
	<div class="mb-5 grid gap-10 pb-10 md:grid-cols-2 lg:grid-cols-3">
		{#each crags as crag}
			<a href="{base}/map/crag/{crag.path}">
				<div class="h-[450px] max-w-sm cursor-pointer rounded-xl shadow-md hover:shadow-lg">
					<div class="p-5">
						<div>
							<h5 class="mt-2 mb-4 overflow-hidden text-2xl font-bold tracking-tight text-gray-900">
								{crag.entry.properties.name}
							</h5>
						</div>

						<p
							class="overflow-show h-28 font-normal"
							style="-webkit-mask-image: linear-gradient(to bottom, white 0%, white 50%, transparent 90%);"
						>
							{$locale === 'de'
								? crag.entry.properties.description_de
								: crag.entry.properties.description_en || crag.entry.properties.description_de}
						</p>
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
