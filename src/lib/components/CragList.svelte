<script>
	import { base } from '$app/paths';
    import { locale } from 'svelte-i18n';

	/** @type {{crags?: any}} */
	let { crags = [] } = $props();

	const imageFiles = import.meta.glob(
		'/src/entries/**/*.{jpg,jpeg,png,gif,pdf}',
		{
			eager: true,
			query: {
				enhanced: true,
				w: '1280;640;400'
			}
		}
	);

	function getImage(path) {
		return Object.entries(imageFiles).filter(([key]) => new RegExp(`^/src/entries/${path}/.*$`).test(key)).map(([, value]) => value)[0]?.default;
	}
</script>
<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-5 pb-10">
	{#each crags as crag}
		<div class="max-w-sm shadow-md rounded-xl hover:shadow-lg h-[450px] flex flex-col transition-shadow relative">
			<div class="relative h-60 shrink-0">
				<a href="{base}/map/crag/{crag.properties.path}" class="block h-full w-full">
					{#if getImage(crag.properties.path)}
						<enhanced:img class="rounded-t-xl h-full w-full object-cover"
													sizes="(min-width:1920px) 1280px, (min-width:1080px) 640px, (min-width:768px) 400px"
													src={getImage(crag.properties.path)} />
					{/if}
				</a>
				{#if crag.properties.has3DTopo}
					<a href="{base}/topo/crag/{crag.properties.path}" class="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-md text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-100 shadow-sm flex items-center gap-1.5 hover:bg-white hover:scale-110 hover:shadow-md hover:border-blue-300 transition-all duration-300">
						<i class="fa-solid fa-cube"></i> 3D
					</a>
				{:else if crag.properties.hasTopo}
					<a href="{base}/topo/crag/{crag.properties.path}" class="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-md text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-100 shadow-sm flex items-center gap-1.5 hover:bg-white hover:scale-110 hover:shadow-md hover:border-emerald-300 transition-all duration-300">
						<i class="fa-solid fa-image"></i> Topo
					</a>
				{/if}
			</div>
			<a href="{base}/map/crag/{crag.properties.path}" class="p-5 flex flex-col flex-1 hover:bg-gray-50 transition-colors rounded-b-xl">
				<div>
					<h5
						class="text-2xl font-bold tracking-tight overflow-hidden text-gray-900 mb-4 mt-2">{crag.properties.name}</h5>
				</div>
				<p class="font-normal overflow-show h-28"
					 style="-webkit-mask-image: linear-gradient(to bottom, white 0%, white 50%, transparent 90%);">
					{$locale === 'de' ? crag.properties.description_de : crag.properties.description_en || crag.properties.description_de}
				</p>
			</a>
		</div>
	{/each}
</div>