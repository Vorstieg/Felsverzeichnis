<script>
	import { base } from '$app/paths';
    import { locale } from 'svelte-i18n';

	/** @type {{crags?: any}} */
	let { crags = [] } = $props();
</script>
<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-5 pb-10">
	{#each crags as crag}
		<a href="{base}/map/crag/{crag.properties.path}">
			<div class="max-w-sm cursor-pointer shadow-md rounded-xl hover:shadow-lg h-[450px]">
				{#if crag.properties.previewImage}
					<img class="rounded-t-xl h-60 w-full object-cover"
						src={crag.properties.previewImage} alt="Crag" />
				{/if}
				<div class="p-5">
					<div>
						<h5
							class="text-2xl font-bold tracking-tight overflow-hidden text-gray-900 mb-4 mt-2">{crag.properties.name}</h5>
					</div>
					<p class="font-normal overflow-show h-28"
						 style="-webkit-mask-image: linear-gradient(to bottom, white 0%, white 50%, transparent 90%);">
						{$locale === 'de' ? crag.properties.description_de : crag.properties.description_en || crag.properties.description_de}
					</p>
				</div>
			</div>
		</a>
	{/each}
</div>