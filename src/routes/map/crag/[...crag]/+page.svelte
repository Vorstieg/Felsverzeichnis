<script>
	import { base } from '$app/paths';
	import { snapToBiggestHeight } from '$lib/assets/js/resize.js';
	import { afterNavigate } from '$app/navigation';
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import { calculateSunInfo, calculateWallDirection } from '$lib/assets/js/sun-calculations';
	import { _, locale } from 'svelte-i18n';
	import { securityRatings } from '$lib/config.js';

	let fullscreenImage = $state();
	let sunInfo = $state({ hours: 'N/A' });
	let wallDirection = $state('N/A');

	/** @type {{data: any}} */
	let { data } = $props();
<<<<<<< HEAD:src/routes/map/crag/[...crag]/+page.svelte
	const { type, name, path, topo, topoJson, transit, parking, meta, has3DTopo, tags, security, grade } = data;
=======
	const { type, name, path, topo, description, transit, parking, meta, security, grade, equipment } = data;

	const equipmentIcons = {
		'Expressschlingen': `${base}/icons/quickdraw.png`,
		'Friends': `${base}/icons/friend.png`,
		'Keile': `${base}/icons/nut.png`,
		'Seil': 'fa-solid fa-infinity',
		'Helm': 'fa-solid fa-hard-hat'
	};
>>>>>>> ed9ddf6 (feat: display crag equipment details on post pages using new icons and add equipment data to crag entries.):src/routes/map/post/[...post]/+page.svelte

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
	<div onclick={() => fullscreenImage = undefined}
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
				<enhanced:img onclick={() => fullscreenImage = images[0].default}
											class="mx-auto h-71 object-cover rounded-md cursor-pointer" src={images[0].default} />
			{:else if images?.length >= 1}
				<div class="flex flex-col flex-wrap content-start h-73 overflow-x-auto no-scrollbar">
					{#each images as image ,i}
						{#if i === 0}
							<enhanced:img onclick={() => fullscreenImage = image.default}
														class="w-60 h-71 mr-1.5 mb-1.5 rounded-2xl object-cover cursor-pointer"
														sizes="(min-width:1920px) 1280px, (min-width:1080px) 640px, (min-width:768px) 400px"
														src={image.default} />
						{:else}
							<enhanced:img onclick={() => fullscreenImage = image.default}
														class="w-34.5 h-34.5 mr-1.5 mb-1.5 rounded-2xl object-cover cursor-pointer"
														sizes="(min-width:1920px) 1280px, (min-width:1080px) 640px, (min-width:768px) 400px"
														src={image.default} />
						{/if}
					{/each}
				</div>
			{/if}
			<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mt-5 mb-6">
				<a href="{base}/map/{type}/"
<<<<<<< HEAD:src/routes/map/crag/[...crag]/+page.svelte
					 class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100 inline-flex items-center justify-center no-underline hover:bg-blue-100 transition-colors">
					{$_('types.' + type)}
				</a>
				{#if grade}
					<span class="px-3 py-1.5 rounded-lg border bg-slate-700 text-white text-sm font-semibold border-slate-800 inline-flex items-center justify-center">
						{grade}
					</span>
				{/if}
				{#if tags && tags.length > 0}
					{#each tags as tag}
						<span class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100">
							{$_('tags.' + tag)}
						</span>
					{/each}
				{/if}
				{#if security && securityRatings.has(security)}
					<div class="flex items-center ml-2 mt-1" title="Absicherung">
						<span class="inline-block">
							{#each Array(securityRatings.get(security)).fill(0) as _, i}
								<i class="fa-solid fa-star text-yellow-400" title="Absicherung"></i>
							{/each}
							{#each Array(4 - securityRatings.get(security)).fill(0) as _, i}
								<i class="fa-regular fa-star text-gray-300" title="Absicherung"></i>
							{/each}
						</span>
					</div>
				{/if}
				{#if topoJson}
					<div class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
						<i class="fa-solid fa-compass text-gray-500"></i>
						<span>{displayWallDirection}</span>
					</div>
					<div class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100">
						<i class="fa-solid fa-clock text-yellow-600"></i>
						<span>{displaySunHours}</span>
					</div>
				{/if}
			</div>
=======
					 class="bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-semibold me-2 px-2.5 py-0.5 rounded-full border border-blue-400 inline-flex items-center justify-center">{types.get(type)}</a>
				<div class="flex items-center ml-2 mt-1" >
					{#if data.grade}
						<span class="bg-slate-700 text-sm text-white font-semibold me-2 px-2.5 py-0.5 rounded-full border border-slate-800 inline-flex items-center justify-center">{data.grade}</span>
					{/if}
					{#if data.security && securityRatings.has(data.security)}
							<span class="inline-block" title="Absicherung">
								{#each Array(securityRatings.get(data.security)).fill(0) as _, i}
									<i class="fa-solid fa-star text-yellow-400" title="Absicherung"></i>
								{/each}
								{#each Array(4 - securityRatings.get(security)).fill(0) as _, i}
									<i class="fa-regular fa-star text-gray-300" title="Absicherung"></i>
								{/each}
							</span>
					{/if}
				</div>
				{#if equipment}
					<div class="mt-3 ml-2">
						<h3 class="text-sm font-bold text-slate-700 mb-1">Ausrüstung:</h3>
						<ul class="list-none p-0">
							{#each equipment as item}
								<li class="text-sm text-slate-600 flex items-center mb-1">
									{#if equipmentIcons[item.name] && equipmentIcons[item.name].startsWith(base)}
										<img src={equipmentIcons[item.name]} alt={item.name} class="w-5 h-5 mr-2 object-contain" />
									{:else}
										<i class="{equipmentIcons[item.name] || 'fa-solid fa-circle'} w-5 text-center mr-2 text-slate-500"></i>
									{/if}
									<span>
										{#if item.amount}{item.amount}x {/if}
										{item.name}
										{#if item.sizes} ({item.sizes}){/if}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</aside>
>>>>>>> ed9ddf6 (feat: display crag equipment details on post pages using new icons and add equipment data to crag entries.):src/routes/map/post/[...post]/+page.svelte
			<div class="flex items-center mt-10 mb-10">
				<div class="prose text-slate-800 w-full">
					<div class="mb-5 w-full">
						{#if has3DTopo}
							<a href="{base}/topo/crag/{path}"
								 class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline">
								<i class="fa-solid fa-cubes mr-2"></i>
								<span class="w-full">{$_('ui.3d_topo')}</span>
							</a>
						{/if}
						{#if topo}
							<a href={topo.link} target="_blank"
								 class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline">
								<i class="fa-solid fa-route mr-2"></i>
								<span class="w-full">{$_('ui.topo')}</span>
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
									{$_('ui.google_maps')}
								</a>
								<a
									href="https://fahrplan.oebb.at/webapp/?context=TP&ZID=A%3D1%40X%3D{Math.trunc(transit[0]*1000000)}%40Y%3D{Math.trunc(transit[1]*1000000)}&timeSel=1&returnTimeSel=1&journeyProducts=7167&start=1&#!P%7CTP!H%7C952087"
									target="_blank"
									class="border-1 border-gray-200 h-10 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium no-underline rounded-r-full">
									{$_('ui.scotty')}
								</a>
							</div>
						{/if}
						{#if parking}
							<a
								href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
								target="_blank"
								class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline">
								<i class="fa-solid fa-car mr-2"></i>
								<span class="w-full">{$_('ui.google_maps')}</span>
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