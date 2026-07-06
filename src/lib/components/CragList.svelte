<script>
	import { base } from '$app/paths';
	import { locale } from 'svelte-i18n';
	import { _ } from 'svelte-i18n';

	/** @type {{crags?: any, isCompact?: boolean}} */
	let { crags = [], isCompact = false } = $props();

	function sectorNames(crag) {
		return crag.properties.sectors
			?.slice(0, 3)
			.map((sector) => sector.name)
			.join(', ');
	}
</script>

{#if isCompact}
	<div class="flex flex-col gap-3 pb-10 mt-2">
		{#each crags as crag}
			<a href="{base}/map/crag/{crag.properties.path}">
				<div class="flex items-center gap-4 cursor-pointer border-b border-gray-100 pb-3 hover:bg-gray-50 transition-colors">
					{#if crag.properties.previewImage}
						<img
							class="rounded-lg h-16 w-16 object-cover shrink-0"
							src={crag.properties.previewImage}
							alt="Crag"
						/>
					{:else}
						<div class="rounded-lg h-16 w-16 bg-slate-100 shrink-0 border border-slate-200"></div>
					{/if}
					<div class="flex-1 overflow-hidden">
						<h5 class="text-base font-bold text-gray-900 truncate mb-1">
							{crag.properties.name}
						</h5>
						{#if crag.properties.sectors?.length}
							<div class="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
								<span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 border border-slate-200">
									{crag.properties.sectors.length} {crag.properties.sectors.length === 1 ? $_('ui.sector') : $_('ui.sectors')}
								</span>
								<span class="truncate">{sectorNames(crag)}</span>
							</div>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
{:else}
	<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-5 pb-10">
		{#each crags as crag}
			<a href="{base}/map/crag/{crag.properties.path}">
				<div class="max-w-sm cursor-pointer shadow-md rounded-xl hover:shadow-lg h-[450px]">
					{#if crag.properties.previewImage}
						<img
							class="rounded-t-xl h-60 w-full object-cover"
							src={crag.properties.previewImage}
							alt="Crag"
						/>
					{/if}
					<div class="p-5">
						<div>
							<h5 class="text-2xl font-bold tracking-tight overflow-hidden text-gray-900 mb-4 mt-2">
								{crag.properties.name}
							</h5>
						</div>
						{#if crag.properties.sectors?.length}
							<div
								class="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600"
							>
								<span class="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 ring-1 ring-blue-100">
									{crag.properties.sectors.length}
									{crag.properties.sectors.length === 1 ? $_('ui.sector') : $_('ui.sectors')}
								</span>
								<span class="truncate text-slate-500">{sectorNames(crag)}</span>
							</div>
						{/if}
						<p
							class="font-normal overflow-show h-28"
							style="-webkit-mask-image: linear-gradient(to bottom, white 0%, white 50%, transparent 90%);"
						>
							{$locale === 'de'
								? crag.properties.description_de
								: crag.properties.description_en || crag.properties.description_de}
						</p>
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
