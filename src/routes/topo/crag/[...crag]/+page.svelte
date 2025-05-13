<script lang="ts">
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import { Canvas, useTask, useThrelte, T } from '@threlte/core';
	import { HTML, OrbitControls, useProgress } from '@threlte/extras';
	import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import { Vector3 } from 'three';
	import Model from '$lib/components/topo/Model.svelte';
	import RouteLine from '$lib/components/topo/RouteLine.svelte';
	import CssObject from '$lib/components/topo/CssObject.svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
    import { types, rockTypes } from '$lib/config.js';

	import { calculateBestSeason, calculateSunInfo, calculateWallDirection, calculateSunPositionVector } from '$lib/assets/js/sun-calculations';
	import SunChart from '$lib/components/charts/SunChart.svelte';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import RouteSteepnessChart from '$lib/components/charts/RouteSteepnessChart.svelte';
	import SteepnessDistribution from '$lib/components/charts/SteepnessDistribution.svelte';
	import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';

	let routeMetrics = $state({
		slab: 'N/A',
		vertical: 'N/A',
		overhang: 'N/A'
	});


	let sunInfo = $state({ hours: 'Calculating...', chartData: null });

	let seasonChartData = $state(null);

	let wallDirection = $state('Unknown');


	let controls = $state();
	// Daylight Simulation State
	let isDaylightSimulation = $state(false);
	let simulationTime = $state(12); // Hours (0-24)
	let simulationDate = $state(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
	const shadowMapSize: [number, number] = [4096, 4096];

	const { progress: progressStore } = useProgress();
	let progress = $state(0);

    const glbFiles = import.meta.glob('/src/entries/**/*.glb', { eager: true, query: '?url', import: 'default' });

	$effect(() => {
		const unsubscribe = progressStore.subscribe(value => {
			progress = value;
		});
		return unsubscribe;
	});

	let { data } = $props();

	let sunLightPosition = $derived.by(() => {
		if (!isDaylightSimulation) return [5, 10, 7];

		let lat = 47;
		let lng = 11;
		if (data.topo && data.topo.coordinates && data.topo.coordinates.length === 2) {
			[lng, lat] = data.topo.coordinates;
		}

		const simDateObj = new Date(simulationDate);
		simDateObj.setHours(0, 0, 0, 0);
		const simTimeMs = simDateObj.getTime() + simulationTime * 3600 * 1000;
		const finalDate = new Date(simTimeMs);

		return calculateSunPositionVector(finalDate, lat, lng);
	});

	let sunPositionVec3 = $derived(new Vector3(...sunLightPosition));
	let sunDirectionVec3 = $derived(new Vector3(0, 0, 0).sub(sunPositionVec3).normalize());

	let ambientIntensity = $derived(isDaylightSimulation ? 0.1 : 0.6);
	let dirLightIntensity = $derived.by(() => {
		if (!isDaylightSimulation) return 1;
		const y = sunLightPosition[1];
		// Fade out when below/near horizon
		if (y < -5) return 0;
		return Math.max(0, Math.min(5.0, 0.1 + (y / 20) * 5));
	});

	function countFixPoints(points: any[]) {
		if (!points) return {};
		return points.reduce((acc, p) => {
			acc[p.type] = (acc[p.type] || 0) + 1;
			return acc;
		}, {});
	}

	function translateFixPoint(type: string) {
		const map: Record<string, string> = {
			'bolt': 'Bohrhaken',
			'anchor': 'Umlenker',
			'piton': 'Normalhaken',
			'hourglass': 'Sanduhr'
		};
		return map[type] || type;
	}

	$effect(() => {
		if (data.topo) {
			sunInfo = calculateSunInfo(data.topo, data.route);
			seasonChartData = calculateBestSeason(data.topo, data.route);
			wallDirection = calculateWallDirection(data.topo, data.route);
		}
	});
	$effect(() => {
		if (!controls) return;

		const updateTarget = () => {
			if (window.innerWidth < 768) {
				controls.target.set(0, -1.5, 0); // Mobile: Move model up
			} else {
				controls.target.set(1, 0, 0); // Desktop: Move model left
			}
			controls.update();
		};
		window.addEventListener('resize', updateTarget);
		updateTarget();

		return () => window.removeEventListener('resize', updateTarget);
	});

	async function share() {
		if (navigator.share) {
			try {
				await navigator.share({
					title: data.topo?.name || 'Felsverzeichnis',
					text: 'Check out this crag!',
					url: window.location.href
				});
			} catch (err) {
				console.error('Error sharing:', err);
			}
		} else {
			alert('Sharing is not supported on this browser.');
		}
	}

	function handleMetrics(event: CustomEvent) {
		routeMetrics = event.detail;
	}

	function SceneSetup() {
		const { scene, size, autoRenderTask, camera } = useThrelte();
		let cssRenderer: CSS2DRenderer;
		let targetElement: HTMLElement | null;
		onMount(() => {
			targetElement = document.getElementById('css-renderer-target');
			if (targetElement && scene && camera && size) {
				cssRenderer = new CSS2DRenderer({ element: targetElement });
				const unsubscribeSize = size.subscribe(value => {
					if (cssRenderer && value.width && value.height) {
						cssRenderer.setSize(value.width, value.height);
					}
				});
				scene.matrixWorldAutoUpdate = false;
				return () => {
					unsubscribeSize();
					if (targetElement) targetElement.innerHTML = '';
					scene.matrixWorldAutoUpdate = true;
				};
			}
		});
		useTask(() => {
			if (!scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
		}, { before: autoRenderTask, autoInvalidate: false });
		useTask(() => {
			if (cssRenderer && scene && camera?.current) cssRenderer.render(scene, camera.current);
		}, { after: autoRenderTask, autoInvalidate: false });
		return null;
	}

	function getGradeColor(grade: string) {
		if (!grade) return '#cccccc';
		const g = grade.toLowerCase();
		if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) return '#4ade80';
		if (g.startsWith('6')) return '#facc15';
		if (g.startsWith('7')) return '#f97316';
		if (g.startsWith('8') || g.startsWith('9')) return '#d946ef';
		return '#cccccc';
	}
</script>

<div class="h-screen w-screen md:w-3/4 absolute">
	<div id="css-renderer-target"
			 style="position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; height: 100%; z-index: 1;"></div>

	<Canvas>
		<T.PerspectiveCamera makeDefault position={[0, 1, 25]} fov={75} near={0.1} far={1000}>
			<OrbitControls enableZoom={true} bind:ref={controls} />
		</T.PerspectiveCamera>
		<T.AmbientLight intensity={ambientIntensity} />
		<T.DirectionalLight
			position={sunLightPosition}
			intensity={dirLightIntensity}
			castShadow
			shadow.mapSize={shadowMapSize}
			shadow.bias={-0.0005}
			shadow.camera.near={1}
			shadow.camera.far={100}
			shadow.camera.left={-50}
			shadow.camera.right={50}
			shadow.camera.top={50}
			shadow.camera.bottom={-50}
		/>

		{#if isDaylightSimulation}
			<CssObject position={sunLightPosition}>
				<div class="flex items-center justify-center w-10 h-10 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-yellow-200" title="Sonne">
					<i class="fa-solid fa-sun text-yellow-600 text-xl"></i>
				</div>
			</CssObject>
			<T.ArrowHelper
				args={[sunDirectionVec3, sunPositionVec3, 2, 0xFDB813, 0.5, 0.25]}
			/>
		{/if}

		<HTML center position={[0, 5, 0]}>
		{#if progress < 1}
			<div
				class="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center gap-3 transition-opacity duration-300">
				<div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
				<div class="text-sm font-medium text-gray-600 whitespace-nowrap">Lade 3D Modell... {Math.round(progress * 100)}
					%
				</div>
			</div>
		{/if}
		</HTML>

		<Model
			modelUrl={glbFiles[`/src/entries/${data.path}/${data.path.split('/').pop()}.glb`]}
		/>
		{#if data && data.topo.routes && progress >= 1}
			{#each data.topo.routes as route (route.id)}
				<RouteLine
					link={base + "/topo/crag/" + data.path + "/" +route.id}
					points={route.points}
					name={route.name}
					grade={route.grade}
					id={route.id}
					color={data.route?.id === route.id ? "#ff0000" : getGradeColor(route.grade)}
					width={data.route?.id === route.id ? 0.2 : 0.15}
					isSelected={data.route?.id === route.id}
				/>
			{/each}
		{/if}

		{#if data && data.topo.fixPoints && progress >= 1}
			{#each data.topo.fixPoints as point}
				<CssObject position={point.position}>
					{#if point.type === 'anchor'}
						<div
							class="flex items-center justify-center w-5 h-5 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-orange-200"
							title="Umlenker/Stand">
							<i class="fa-solid fa-anchor text-xs text-orange-500"></i>
						</div>
					{:else if point.type === 'piton'}
						<div
							class="flex items-center justify-center w-4 h-4 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-gray-200"
							title="Normalhaken">
							<i class="fa-solid fa-thumb-tack text-[10px] text-gray-500"></i>
						</div>
					{:else if point.type === 'hourglass'}
						<div
							class="flex items-center justify-center w-4 h-4 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-yellow-200"
							title="Sanduhr">
							<i class="fa-solid fa-hourglass-half text-[10px] text-yellow-600"></i>
						</div>
					{:else}
						<div
							class="flex items-center justify-center w-3 h-3 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-red-200"
							title="Bohrhaken">
							<div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
						</div>
					{/if}
				</CssObject>
			{/each}
		{/if}

		<SceneSetup />
	</Canvas>
</div>


<main class="z-[500] h-24">
	<InfoPanel onShare={share}>
		{#snippet controls()}
			                        			{#if isDaylightSimulation}
			                        				<div
			                                            transition:slide={{ axis: 'x', duration: 300 }}
			                        					class="bg-white/90 backdrop-blur px-2 py-1 rounded-l-full rounded-r-none shadow-sm border border-gray-200 flex items-center gap-2 pointer-events-auto h-8">
			                        					<input			            						type="date"
			            						value={simulationDate}
			            						oninput={(e) => simulationDate = e.currentTarget.value}
			            						class="text-xs font-bold text-gray-500 bg-transparent border-none outline-none w-24 cursor-pointer font-mono"
			            					/>
			            					            					<div class="w-px h-4 bg-gray-300 mx-1"></div>
			            					            					<span class="text-xs font-bold text-gray-500 w-8 text-right font-mono">
			            					            						{Math.floor(simulationTime)}:{(Math.floor((simulationTime % 1) * 60)).toString().padStart(2, '0')}
			            					            					</span>			            					<input
			            						type="range"
			            						min="0"
			            						max="24"
			            						step="0.25"
			            						value={simulationTime}
			            						oninput={(e) => simulationTime = parseFloat(e.currentTarget.value)}
			            						class="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
			            					/>
			            				</div>
			            			{/if}
			            			
			            			<button
			            				class="pointer-events-auto cursor-pointer w-8 h-8 pt-0.5 text-sm hover:text-white hover:bg-ink border-1 text-center border-gray-200 transition-all {isDaylightSimulation ? 'rounded-r-full rounded-l-none' : 'rounded-full'} {isDaylightSimulation ? 'bg-yellow-100 text-yellow-600 border-yellow-300' : 'bg-white'}"
			            				onclick={() => isDaylightSimulation = !isDaylightSimulation}
			            				title="Daylight Simulator"
			            			>
				<i class="fa-solid fa-sun {isDaylightSimulation ? 'text-yellow-600' : ''}"></i>
			</button>
		{/snippet}

		{#if data.route}
			<div
				class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5">
				<a href="{base}/topo/crag/{data.path}" class="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors">
					<i class="fa-solid fa-arrow-left text-gray-600"></i>
				</a>
				<h1 class="text-2xl font-bold my-0 text-slate-800 sm:px-2">{data.route.name}</h1>
			</div>

			<div
				class="flex-1 overflow-y-auto w-full px-8 mb-4 overflow-x-hidden min-h-0">
				<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mb-6">
					<div class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
						<i class="fa-solid fa-compass text-gray-500"></i>
						<span>{wallDirection}</span>
					</div>
					<div class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100">
						<i class="fa-solid fa-clock text-yellow-600"></i>
						<span>{sunInfo.hours}</span>
					</div>
					{#if data.route.tags && data.route.tags.length > 0}
						{#each data.route.tags as tag}
							<span class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100">
								{tag}
							</span>
						{/each}
					{/if}
				</div>
				<div class="mb-5 prose mx-auto">
					{#if data.route.description}
						<div class="border-b border-gray-200 p-3">
							{data.route.description}
						</div>
					{/if}
												{#if data.route.type}
												<div class="border-b border-gray-200 p-3">Kletterart: {types.get(data.route.type) || data.route.type}</div>
												{/if}					{#if data.route.grade}
						<div class="border-b border-gray-200 p-3">Grad: {data.route.grade}</div>
					{/if}
					{#if data.route.length}
						<div class="border-b border-gray-200 p-3">Länge: {data.route.length} m</div>
					{/if}
					{#if data.route.boltAmount}
						<div class="border-b border-gray-200 p-3">Anzahl an benötigten Exen: {data.route.boltAmount}</div>
					{/if}
												{#if data.topo.rock}
												<div class="border-b border-gray-200 p-3">Steinart: {rockTypes.get(data.topo.rock) || data.topo.rock}</div>
												{/if}				</div>
				<div class="mt-6 w-full">
					<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Steilheitsverteilung</h3>
					<div class="mb-8">
						<SteepnessDistribution metrics={routeMetrics} />
					</div>
					<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Steilheit</h3>
					<div class="h-48 w-full mb-8">
						<RouteSteepnessChart route={data.route} on:metrics={handleMetrics} />
					</div>

					{#if sunInfo.chartData}
						<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Sonnenverlauf</h3>
						<div class="h-32 w-full">
							<SunChart data={sunInfo.chartData} />
						</div>
					{/if}
				</div>

			</div>
		{:else}
			<div
				class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5">
				<a href="{base}/map/crag/{data.path}" class="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors">
					<i class="fa-solid fa-arrow-left text-gray-600"></i>
				</a>
				<h1 class="text-2xl font-bold my-0 text-slate-800 sm:px-2">{data.topo.name}</h1>
			</div>

			<div
				class="flex-1 overflow-y-auto w-full px-8 mb-4 overflow-x-hidden min-h-0">
				<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mb-6">
					<div class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
						<i class="fa-solid fa-compass text-gray-500"></i>
						<span>{wallDirection}</span>
					</div>
					<div class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100">
						<i class="fa-solid fa-clock text-yellow-600"></i>
						<span>{sunInfo.hours}</span>
					</div>
					{#if data.topo.tags && data.topo.tags.length > 0}
						{#each data.topo.tags as tag}
							<span class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100">
								{tag}
							</span>
						{/each}
					{/if}
				</div>
				<div class="flex flex-col mt-2 mb-10">

					<!-- Stats & Description -->
					<div class="prose text-slate-800 mb-4">
						<p class="text-sm text-gray-600">{data.topo.description}</p>

					</div>

					{#if data.topo.routes || sunInfo.chartData}

						<div class="mb-8 w-full">
							{#if data.topo.routes}
								<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Schwierigkeitsverteilung</h3>
								<div class="h-32 w-full mb-6">
									<GradeChart routes={data.topo.routes} />
								</div>
							{/if}
							{#if seasonChartData}
								<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Saisonalität</h3>
								<div class="h-48 w-full mb-6">
									<BestSeasonChart data={seasonChartData} />
								</div>
							{/if}
							{#if sunInfo.chartData}
								<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Sonnenverlauf</h3>
								<div class="h-32 w-full">
									<SunChart data={sunInfo.chartData} />
								</div>
							{/if}
						</div>
					{/if}

					<!-- Fix Points List -->
					{#if data.topo.fixPoints && data.topo.fixPoints.length > 0}
						<div class="w-full mb-8">
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Absicherung</h3>
							<div class="overflow-x-auto sm:rounded-xl border border-gray-200 shadow-sm bg-white p-4">
								<div class="flex flex-wrap gap-2">
									{#each Object.entries(countFixPoints(data.topo.fixPoints)) as [type, count]}
										<span
											class="px-3 py-1 rounded-full bg-gray-50 text-sm font-medium text-gray-700 border border-gray-200">
											{count}x {translateFixPoint(type)}
										</span>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Route List -->
					<div class="w-full">
						<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">Routen ({data.topo.routes.length})</h3>
						<div class="overflow-x-auto sm:rounded-xl border border-gray-200 shadow-sm bg-white">
							<table class="min-w-full divide-y divide-gray-200 !m-0">
								<thead class="bg-gray-50">
								<tr>
									{#each ["Name", "Grad", "Länge"] as column}
										<th scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
											{column}
										</th>
									{/each}
								</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
								{#each data.topo.routes as route}
									<tr
										class="hover:bg-blue-50 cursor-pointer transition-colors"
										onclick={() => goto(base + "/topo/crag/" + data.path + "/" +route.id)}>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											{route.name}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm">
											<span
												class="px-2 py-1 rounded-md bg-gray-100 font-bold text-gray-700 text-xs border border-gray-300">
												{route.grade}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{route.length}m
										</td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</InfoPanel>
</main>

<style>
    :global(.route-label) {
        background-color: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 3px 7px;
        border-radius: 4px;
        font-size: 9px;
        font-family: sans-serif;
        white-space: nowrap;
        text-align: center;
        cursor: pointer;
    }

    .transition-transform {
        transition: transform 0.3s ease-in-out;
    }

    .rotate-180 {
        transform: rotate(180deg);
    }
</style>
