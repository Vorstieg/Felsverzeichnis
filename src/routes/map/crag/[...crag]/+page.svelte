<script>
	import { base } from '$app/paths';
	import { snapToBiggestHeight } from '$lib/assets/js/resize.js';
	import { afterNavigate } from '$app/navigation';
	import { types } from '$lib/config.js';
    import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import { calculateSunInfo, calculateWallDirection } from '$lib/assets/js/sun-calculations';

	let fullscreenImage = $state();
	let sunInfo = $state({ hours: 'N/A' });
	let wallDirection = $state('N/A');

	/** @type {{data: any}} */
	let { data } = $props();

	$effect(() => {
		if (data.topoJson) {
			sunInfo = calculateSunInfo(data.topoJson);
			wallDirection = calculateWallDirection(data.topoJson);
		}
	});

	const { type, name, path, topo, topoJson, description, transit, parking, meta, has3DTopo, tags } = data;

	afterNavigate((_navigation) => {
		if (location.hash) onMarkerClicked();
	});

	function onMarkerClicked() {
		if (snapToBiggestHeight) {
			snapToBiggestHeight();
		}
	}

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
	const images = Object.entries(imageFiles).filter(([key]) => new RegExp(`^/src/entries/${path}/.*$`).test(key)).map(([, value]) => value);

	async function share() {
		await navigator.share({
			title: name,
			text: description,
			url: window.location.href
		});
	}
</script>

{#if fullscreenImage}
	<div class="absolute top-0 bottom-0 left-0 right-0 z-[30000] bg-black opacity-70"></div>
	<div on:click={() => fullscreenImage = undefined}
			 class="absolute top-0 bottom-0 left-0 right-0 z-[30000] flex justify-center items-center">
		<enhanced:img class="self-center" src={fullscreenImage} />
	</div>
{/if}
<main class="z-[500] h-24">
    <InfoPanel onShare={share}>
		<div class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row pt-6 pb-5">
			<h1 class="text-2xl font-bold my-0 text-slate-800 sm:px-2">{name}</h1>
		</div>
		<div
			class="flex-1 overflow-y-auto w-full px-5 mb-4 overflow-x-hidden min-h-0"
			>
			{#if images?.length === 1}
				<enhanced:img on:click={() => fullscreenImage = images[0].default}
											class="mx-auto h-71 object-cover rounded-md cursor-pointer" src={images[0].default} />
			{:else if images?.length >= 1}
				<div class="flex flex-col flex-wrap content-start h-73 overflow-x-auto no-scrollbar">
					{#each images as image ,i}
						{#if i === 0}
							<enhanced:img on:click={() => fullscreenImage = image.default}
														class="w-60 h-71 mr-1.5 mb-1.5 rounded-2xl object-cover cursor-pointer"
														sizes="(min-width:1920px) 1280px, (min-width:1080px) 640px, (min-width:768px) 400px"
														src={image.default} />
						{:else}
							<enhanced:img on:click={() => fullscreenImage = image.default}
														class="w-34.5 h-34.5 mr-1.5 mb-1.5 rounded-2xl object-cover cursor-pointer"
														sizes="(min-width:1920px) 1280px, (min-width:1080px) 640px, (min-width:768px) 400px"
														src={image.default} />
						{/if}
					{/each}
				</div>
			{/if}
			<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mt-5 mb-6">
				<a href="{base}/map/{type}/"
					 class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100 inline-flex items-center justify-center no-underline hover:bg-blue-100 transition-colors">
					{types.get(type)}
				</a>
				{#if tags && tags.length > 0}
					{#each tags as tag}
						<span class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100">
							{tag}
						</span>
					{/each}
				{/if}
				{#if topoJson}
					<div class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
						<i class="fa-solid fa-compass text-gray-500"></i>
						<span>{wallDirection}</span>
					</div>
					<div class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100">
						<i class="fa-solid fa-clock text-yellow-600"></i>
						<span>{sunInfo.hours}</span>
					</div>
				{/if}
			</div>
			<div class="flex items-center mt-10 mb-10">
				<div class="prose text-slate-800 w-full">
					<div class="mb-5 w-full">
						{#if has3DTopo}
							<a href="{base}/topo/crag/{path}"
								 class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline">
								<i class="fa-solid fa-cubes mr-2"></i>
								<span class="w-full">3D Topo</span>
							</a>
						{/if}
						{#if topo}
							<a href={topo.link} target="_blank"
								 class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline">
								<i class="fa-solid fa-route mr-2"></i>
								<span class="w-full">Topo</span>
							</a>
						{/if}
						{#if transit}
							<div class="inline-flex mb-2 mr-2">
								<span
									class="border-1 border-gray-200 h-10 text-slate-600 inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-l-full no-underline "><i
									class="fa-solid fa-train"></i>
								</span>
								<a
									href="https://www.google.com/maps/dir/?api=1&destination={transit[1]},{transit[0]}&travelmode=transit"
									target="_blank"
									class="border-1 border-gray-200 h-10 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium no-underline">
									Google Maps
								</a>
								<a
									href="https://fahrplan.oebb.at/webapp/?context=TP&ZID=A%3D1%40X%3D{Math.trunc(transit[0]*1000000)}%40Y%3D{Math.trunc(transit[1]*1000000)}&timeSel=1&returnTimeSel=1&journeyProducts=7167&start=1&#!P%7CTP!H%7C952087"
									target="_blank"
									class="border-1 border-gray-200 h-10 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium no-underline rounded-r-full">
									Scotty
								</a>
							</div>
						{/if}
						{#if parking}
							<a
								href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
								target="_blank"
								class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline">
								<i class="fa-solid fa-car mr-2"></i>
								<span class="w-full">Google Maps</span>
							</a>
						{/if}
					</div>
					<span>{description}</span>

					{#if topoJson && topoJson.routes}
						<div class="h-40 w-full mt-5 mb-5 not-prose">
							<GradeChart routes={topoJson.routes} />
						</div>
					{/if}
				</div>
			</div>
		</div>
    </InfoPanel>
</main>

