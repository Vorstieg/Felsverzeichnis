<script lang="ts">
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import { Canvas, useTask, useThrelte, T } from '@threlte/core';
	import { HTML, OrbitControls, useProgress, interactivity } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import { Vector3, WebGLRenderer, TOUCH, Box3, Sphere } from 'three';
	import { cubicOut } from 'svelte/easing';
	import Model from '$lib/components/topo/Model.svelte';
	import RouteLine from '$lib/components/topo/RouteLine.svelte';
	import CssObject from '$lib/components/topo/CssObject.svelte';
	import Topo2DViewer from '$lib/components/topo/Topo2DViewer.svelte';
	import TopoLegend from '$lib/components/topo/TopoLegend.svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import { locale } from 'svelte-i18n';
	import { browser } from '$app/environment';

	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import {
		calculateBestSeason,
		calculateSunInfo,
		calculateSunPositionVector,
		calculateWallDirection
	} from '$lib/assets/js/sun-calculations';
	import SunChart from '$lib/components/charts/SunChart.svelte';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import RouteSteepnessChart from '$lib/components/charts/RouteSteepnessChart.svelte';
	import SteepnessDistribution from '$lib/components/charts/SteepnessDistribution.svelte';
	import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';

	let { data } = $props();
	let currentSectorName = $derived(data.sector?.name || data.sectorId);
	let availableSectors = $derived(data.sectors || []);

	let routeMetrics = $state({
		slab: 'N/A',
		vertical: 'N/A',
		overhang: 'N/A'
	});

	let sunInfo = $state({ hours: 'Calculating...', chartData: null });

	let seasonChartData = $state(null);

	let wallDirection = $state('Unknown');
	let activeRenderer = $state('');
	let isCameraMoving = $state(false);
	let camera = $state();

	let controls = $state();
	// Daylight Simulation State
	let isDaylightSimulation = $state(false);
	let simulationTime = $state(12); // Hours (0-24)
	let simulationDate = $state(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
	const shadowMapSize = $derived(browser && window.innerWidth < 768 ? [1024, 1024] : [4096, 4096]);

	const { progress: progressStore } = useProgress();
	let progress = $state(0);
	let modelLoaded = $state(false);
	let initialLoadComplete = $state(false);

	let isSlowNetwork = $state(false);
	let forceHighRes = $state(false);

	$effect(() => {
		if (modelLoaded) {
			initialLoadComplete = true;
		}
	});

	$effect(() => {
		if (browser && navigator.connection) {
			const conn = navigator.connection;
			if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g' || conn.type === 'cellular') {
				isSlowNetwork = true;
			}
		}
	});

	let activeModelUrl = $derived(
		data.lowResModelUrl && !forceHighRes 
			? data.lowResModelUrl 
			: data.modelUrl
	);

	let has3D = $derived(data.has3D);
	let has2D = $derived(
		!!data.topo?.image2D ||
			data.topo?.routes?.some((r) => r.points2D?.length > 0) ||
			data.topo?.outlines?.length > 0 ||
			data.topo?.fixPoints?.some((fp) => fp.position2D)
	);
	let displayMode = $state('3d');
	let isTopoLegendOpen = $state(false);
	let usedTopoSymbolTypes = $derived(
		Array.from(
			new Set(
				(data.route?.fixPoints
					? data.topo?.fixPoints?.filter((fp) => data.route.fixPoints?.includes(fp.id))
					: data.topo?.fixPoints
				)?.map((fp) => fp.type) || []
			)
		)
	);

	let lastPath = $state('');
	$effect(() => {
		const modeParam = $page.url.searchParams.get('mode');

		if (data.path !== lastPath || modeParam) {
			lastPath = data.path || '';

			if (modeParam === '2d' && has2D) {
				displayMode = '2d';
			} else if (modeParam === '3d' && has3D) {
				displayMode = '3d';
			} else {
				if (has3D) {
					displayMode = '3d';
				} else if (has2D) {
					displayMode = '2d';
				}
			}
		}
	});

	let animationState = $state(null);

	function getParentRoute(childId: string) {
		if (!data.topo || !data.topo.routes) return null;
		return data.topo.routes.find(
			(r) => r.id === childId || (r.pitches && r.pitches.some((p) => p.id === childId))
		);
	}

	function focusRoute(route: any) {
		if (!route || !controls || !camera) return;

		// 1. Collect points
		let points: number[][] = [];
		if (route.type?.includes('multi-pitch') && route.pitches) {
			route.pitches.forEach((p: any) => {
				if (p.points) points.push(...p.points);
			});
		} else if (route.points) {
			points = route.points;
		}

		if (!points || points.length === 0) return;

		// 2. Calculate Bounding Sphere
		const box = new Box3();
		points.forEach((p) => box.expandByPoint(new Vector3(p[0], p[1], p[2])));
		const center = new Vector3();
		box.getCenter(center);
		const sphere = new Sphere();
		box.getBoundingSphere(sphere);

		// 3. Determine Orientation
		let orientation = new Vector3(0, 0, 1);
		const parent = getParentRoute(route.id);
		const sourceRoute = parent || route;

		if (sourceRoute.orientation) {
			orientation.set(
				sourceRoute.orientation[0],
				sourceRoute.orientation[1],
				sourceRoute.orientation[2]
			);
		}

		orientation.normalize();

		// 4. Calculate Distance
		// FOV 75 deg
		const fov = 75 * (Math.PI / 180);
		// distance to fit sphere: radius / sin(fov/2)
		// We use a slight padding factor
		const dist = (sphere.radius * 1.5) / Math.sin(fov / 2);
		const finalDist = Math.max(dist, 5); // Minimum distance

		const targetPos = center.clone().add(orientation.multiplyScalar(finalDist));

		// 5. Start Animation
		if (camera) {
			animationState = {
				startPos: camera.position.clone(),
				endPos: targetPos,
				startTarget: controls.target.clone(),
				endTarget: center,
				startTime: Date.now(),
				duration: 1000
			};
		}
	}

	let lastFocusedRouteId = $state(null);
	let hoveredRouteId = $state(null);

	$effect(() => {
		if (data.route && modelLoaded && !isCameraMoving && data.route.id !== lastFocusedRouteId) {
			lastFocusedRouteId = data.route.id;
			hoveredRouteId = null;
			focusRoute(data.route);
		}
	});

	$effect(() => {
		if (hoveredRouteId && modelLoaded && !isCameraMoving) {
			const r = data.topo.routes.find((r) => r.id === hoveredRouteId);
			if (r) focusRoute(r);
		}
	});

	$effect(() => {
		if (isCameraMoving) {
			animationState = null;
		}
	});

	$effect(() => {
		const unsubscribe = progressStore.subscribe((value) => {
			progress = value;
		});
		return unsubscribe;
	});

	let description = $derived(
		$locale === 'de'
			? data.topo?.description_de
			: data.topo?.description_en || data.topo?.description_de
	);
	let displayWallDirection = $derived(
		wallDirection !== 'Unknown' ? $_('directions.' + wallDirection) : wallDirection
	);
	let displaySunHours = $derived(
		sunInfo.hours === 'shade_all_day' || sunInfo.hours === 'no_geodata'
			? $_('sun.' + sunInfo.hours)
			: sunInfo.hours
	);

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

	let visualRoutes = $derived.by(() => {
		if (!data || !data.topo || !data.topo.routes) return [];

		return data.topo.routes.flatMap((route) => {
			if (route.type?.includes('multi-pitch') && route.pitches) {
				return route.pitches.map((pitch, idx) => ({
					...pitch,
					id: pitch.id,
					parentId: route.id,
					name: `${route.name} P${idx + 1}`,
					grade: pitch.grade,
					points: pitch.points,
					originalRoute: route
				}));
			}
			return [route];
		});
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
			bolt: 'Bohrhaken',
			belay: 'Umlenker',
			piton: 'Normalhaken',
			hourglass: 'Sanduhr'
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
					title: data.topo?.name || $_('site.title'),
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

	const createRenderer = (canvas) => {
		const context = canvas.getContext('webgl2', {
			alpha: true,
			depth: true,
			stencil: false,
			antialias: true,
			powerPreference: 'high-performance'
		});

		return new WebGLRenderer({
			canvas,
			context,
			powerPreference: 'high-performance',
			antialias: true,
			precision: 'highp',
			alpha: true
		});
	};

	function SceneSetup() {
		const { scene, size, autoRenderTask, camera, renderer } = useThrelte();

		interactivity({ filter: (hits) => hits.slice(0, 1) });

		let cssRenderer: CSS2DRenderer;
		let targetElement: HTMLElement | null;
		onMount(() => {
			targetElement = document.getElementById('css-renderer-target');
			if (targetElement && scene && camera && size) {
				cssRenderer = new CSS2DRenderer({ element: targetElement });
				const unsubscribeSize = size.subscribe((value) => {
					if (cssRenderer && value.width && value.height) {
						cssRenderer.setSize(value.width, value.height);
					}
				});
				return () => {
					unsubscribeSize();
					if (targetElement) targetElement.innerHTML = '';
				};
			}
		});
		useTask(
			() => {
				if (cssRenderer && scene && camera?.current) cssRenderer.render(scene, camera.current);

				if (animationState && camera?.current && controls) {
					const elapsed = (Date.now() - animationState.startTime) / animationState.duration;
					if (elapsed >= 1) {
						camera.current.position.copy(animationState.endPos);
						controls.target.copy(animationState.endTarget);
						animationState = null;
					} else {
						const t = cubicOut(elapsed);
						camera.current.position.lerpVectors(animationState.startPos, animationState.endPos, t);
						controls.target.lerpVectors(animationState.startTarget, animationState.endTarget, t);
					}
					controls.update();
				}
			},
			{ after: autoRenderTask, autoInvalidate: false }
		);
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

	function getSectorRouteCount(sector: any) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		if (routes.length > 0) return routes.length;

		return (
			sector.routesCount ||
			sector.routeCount ||
			sector.routes?.length ||
			sector.assets?.routes?.length ||
			0
		);
	}

	function getSectorGradeDistribution(sector: any) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		if (routes.length === 0) return [];

		let easy = 0, medium = 0, hard = 0, veryHard = 0;
		routes.forEach(r => {
			const g = r.grade || '';
			if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) easy++;
			else if (g.startsWith('6')) medium++;
			else if (g.startsWith('7')) hard++;
			else if (g.startsWith('8') || g.startsWith('9')) veryHard++;
		});
		
		const total = easy + medium + hard + veryHard;
		if (total === 0) return [];
		
		return [
			{ count: easy, percent: (easy/total)*100, colorClass: 'bg-green-500', label: '< 6a' },
			{ count: medium, percent: (medium/total)*100, colorClass: 'bg-yellow-400', label: '6a - 6c+' },
			{ count: hard, percent: (hard/total)*100, colorClass: 'bg-red-500', label: '7a - 7c+' },
			{ count: veryHard, percent: (veryHard/total)*100, colorClass: 'bg-purple-600', label: '> 8a' }
		].filter(b => b.count > 0);
	}

	function getSectorDirection(sector: any) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		const mockTopo = { 
			wallAzimuth: sector.wallAzimuth || sector.topo?.wallAzimuth || sector.properties?.wallAzimuth || routes[0]?.sectorWallAzimuth,
			routes 
		};
		const dir = calculateWallDirection(mockTopo, null);
		return dir !== 'Unknown' ? $_('directions.' + dir) : null;
	}
	
	function getSectorTypes(sector: any) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		let t = routes[0]?.sectorTags;
		if (!t || (Array.isArray(t) && t.length === 0)) t = sector.type;
		if (!t || (Array.isArray(t) && t.length === 0)) t = sector.properties?.type;
		if (!t || (Array.isArray(t) && t.length === 0)) t = data.cragType;
		
		let arr: string[] = [];
		if (Array.isArray(t)) {
			arr = t;
		} else if (typeof t === 'string' && t.trim()) {
			arr = t.includes(',') ? t.split(',').map(x => x.trim()) : [t];
		}
		
		return arr.map(x => {
			const translated = $_('tags.' + x);
			return {
				id: x,
				name: translated === 'tags.' + x ? x : translated
			};
		});
	}

	function getTypeColorClass(typeId: string) {
		switch(typeId) {
			case 'sports-climbing': return 'bg-blue-100 text-blue-700 border-blue-200';
			case 'bouldering': return 'bg-orange-100 text-orange-700 border-orange-200';
			case 'multi-pitch': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
			case 'trad': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
			default: return 'bg-slate-100 text-slate-600 border-slate-200';
		}
	}
</script>

<div class="topo-container h-screen w-screen md:w-3/4 absolute overflow-hidden">
	{#if displayMode === '2d' && data.topo}
		<Topo2DViewer
			topo={data.topo}
			routes={data.topo?.routes}
			selectedRouteId={data.route?.id}
			onRouteSelect={(route) => goto(`${base}/topo/crag/${data.path || ''}/${route.id}`)}
			bind:hoveredRouteId
		/>
	{:else}
		<div
			id="css-renderer-target"
			style="position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; height: 100%; z-index: 1; overflow: hidden;"
		></div>

		<Canvas {createRenderer} dpr={browser ? window.devicePixelRatio : 1}>
			<T.PerspectiveCamera
				makeDefault
				position={[0, 1, 25]}
				fov={75}
				near={0.1}
				far={1000}
				bind:ref={camera}
			>
				<OrbitControls
					enableZoom={true}
					bind:ref={controls}
					touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
					onstart={() => (isCameraMoving = true)}
					onend={() => (isCameraMoving = false)}
				/>
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
					<div
						class="flex items-center justify-center w-10 h-10 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-yellow-200"
						title={$_('ui.sun')}
					>
						<i class="fa-solid fa-sun text-yellow-600 text-xl"></i>
					</div>
				</CssObject>
				<T.ArrowHelper args={[sunDirectionVec3, sunPositionVec3, 2, 0xfdb813, 0.5, 0.25]} />
			{/if}

			<HTML center position={[0, 5, 0]}>
				{#if !initialLoadComplete}
					<div
						class="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center gap-3 transition-opacity duration-300"
					>
						<div
							class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"
						></div>
						<div class="text-sm font-medium text-gray-600 whitespace-nowrap">
							{$_('topo.loading')}
							{Math.round(progress * 100)}%
						</div>
					</div>
				{/if}
			</HTML>

			<Model modelUrl={activeModelUrl} onload={() => (modelLoaded = true)} />
			{#if data.lowResModelUrl && !isSlowNetwork && !forceHighRes && modelLoaded}
				<Model 
					modelUrl={data.modelUrl} 
					visible={false} 
					onload={() => { forceHighRes = true; }} 
				/>
			{/if}
			
			{#if visualRoutes && initialLoadComplete}
				{#each visualRoutes as route (route.id)}
					<RouteLine
						link={base + '/topo/crag/' + data.path + '/' + (route.parentId || route.id)}
						points={route.points}
						name={route.name}
						grade={route.grade}
						id={route.id}
						color={data.route?.id === (route.parentId || route.id)
							? '#ff0000'
							: getGradeColor(route.grade)}
						width={data.route?.id === (route.parentId || route.id) ? 0.1 : 0.08}
						isSelected={data.route?.id === (route.parentId || route.id)}
						{isCameraMoving}
						isHoveredExternally={hoveredRouteId === (route.parentId || route.id)}
					/>
				{/each}
			{/if}

			{#if data && data.topo.fixPoints && initialLoadComplete && data.route}
				{#each data.topo.fixPoints.filter((fp) => data.route.fixPoints?.includes(fp.id)) as point}
					<CssObject position={point.position}>
						{#if point.type === 'anchor'}
							<div
								class="flex items-center justify-center w-5 h-5 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-orange-200"
								title={$_('topo.fixpoints.anchor')}
							>
								<i class="fa-solid fa-anchor text-xs text-orange-500"></i>
							</div>
						{:else if point.type === 'piton'}
							<div
								class="flex items-center justify-center w-4 h-4 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-gray-200"
								title={$_('topo.fixpoints.piton')}
							>
								<i class="fa-solid fa-thumb-tack text-[10px] text-gray-500"></i>
							</div>
						{:else if point.type === 'hourglass'}
							<div
								class="flex items-center justify-center w-4 h-4 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-yellow-200"
								title={$_('topo.fixpoints.hourglass')}
							>
								<i class="fa-solid fa-hourglass-half text-[10px] text-yellow-600"></i>
							</div>
						{:else}
							<div
								class="flex items-center justify-center w-3 h-3 bg-white/80 rounded-full shadow-sm backdrop-blur-sm border border-red-200"
								title={$_('topo.fixpoints.bolt')}
							>
								<div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
							</div>
						{/if}
					</CssObject>
				{/each}
			{/if}

			<SceneSetup />
		</Canvas>
	{/if}
</div>

<main class="z-[500] h-24">
	<InfoPanel onShare={share}>
		{#snippet controls()}
			{#if isDaylightSimulation && displayMode === '3d'}
				<div
					transition:slide={{ axis: 'x', duration: 300 }}
					class="bg-white/90 backdrop-blur px-2 py-1 rounded-l-full rounded-r-none shadow-sm border border-gray-200 flex items-center gap-2 pointer-events-auto h-8"
				>
					<input
						type="date"
						value={simulationDate}
						oninput={(e) => (simulationDate = e.currentTarget.value)}
						class="text-xs font-bold text-gray-500 bg-transparent border-none outline-none w-24 cursor-pointer font-mono"
					/>
					<div class="w-px h-4 bg-gray-300 mx-1"></div>
					<span class="text-xs font-bold text-gray-500 w-8 text-right font-mono">
						{Math.floor(simulationTime)}
						:{Math.floor((simulationTime % 1) * 60)
							.toString()
							.padStart(2, '0')}
					</span>
					<input
						type="range"
						min="0"
						max="24"
						step="0.25"
						value={simulationTime}
						oninput={(e) => (simulationTime = parseFloat(e.currentTarget.value))}
						class="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
					/>
				</div>
			{/if}

			{#if displayMode === '3d'}
				<button
					class="pointer-events-auto cursor-pointer w-8 h-8 pt-0.5 text-sm hover:text-white hover:bg-ink border-1 text-center border-gray-200 transition-all {isDaylightSimulation
						? 'rounded-r-full rounded-l-none'
						: 'rounded-full'} {isDaylightSimulation
						? 'bg-yellow-100 text-yellow-600 border-yellow-300'
						: 'bg-white'}"
					onclick={() => (isDaylightSimulation = !isDaylightSimulation)}
					aria-label="Toggle daylight simulator"
					title="Daylight Simulator"
				>
					<i class="fa-solid fa-sun {isDaylightSimulation ? 'text-yellow-600' : ''}"></i>
				</button>
			{/if}

			{#if displayMode === '3d' && data.lowResModelUrl}
				{#if progress < 1 && (forceHighRes || (!isSlowNetwork && modelLoaded))}
					<div class="pointer-events-auto flex items-center h-8 px-3 ml-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-full border border-blue-100 shadow-sm gap-2">
						<div class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
						HD {Math.round(progress * 100)}%
					</div>
				{:else if !forceHighRes && isSlowNetwork}
					<button
						class="pointer-events-auto cursor-pointer h-8 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm flex items-center gap-1 transition-all ml-2"
						onclick={() => (forceHighRes = true)}
						title={$_('topo.load_high_res_title') || 'Load High-Res 3D Model'}
					>
						<i class="fa-solid fa-download"></i>
						{$_('topo.load_high_res') || 'HD'}
					</button>
				{/if}
			{/if}

			{#if has2D && has3D}
				<div
					class="flex bg-white/90 backdrop-blur rounded-full p-1 shadow-sm border border-gray-200 pointer-events-auto ml-2 h-8 items-center"
				>
					<button
						class="px-3 h-6 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 {displayMode ===
						'3d'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-gray-500 hover:text-gray-700'}"
						onclick={() => (displayMode = '3d')}
					>
						<i class="fa-solid fa-cube text-[8px]"></i>
						3D
					</button>
					<button
						class="px-3 h-6 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 {displayMode ===
						'2d'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-gray-500 hover:text-gray-700'}"
						onclick={() => (displayMode = '2d')}
					>
						<i class="fa-solid fa-image text-[8px]"></i>
						2D
					</button>
				</div>
			{/if}
		{/snippet}

		{#if data.route}
			<div
				class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5"
			>
				<a
					href="{base}/topo/crag/{data.path}"
					class="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
					aria-label={$_('ui.back_to_topo')}
				>
					<i class="fa-solid fa-arrow-left text-gray-600"></i>
				</a>
				<div class="min-w-0">
					<h1 class="truncate text-2xl font-bold my-0 text-slate-800 sm:px-2">{data.route.name}</h1>
					{#if data.isSectorPath}
						<div class="mt-1 flex items-center gap-2 sm:px-2">
							<span
								class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100"
								>{$_('ui.sector')}: {currentSectorName}</span
							>
							<a
								href="{base}/map/crag/{data.path}"
								class="text-xs font-semibold text-slate-500 no-underline hover:text-blue-700"
								>{$_('ui.open_map')}</a
							>
						</div>
					{/if}
				</div>
			</div>

			<div class="flex-1 overflow-y-auto w-full px-8 mb-4 overflow-x-hidden min-h-0">
				<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mb-6">
					<Tooltip text={$_('topo.wall_direction')}>
						<div
							class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200"
						>
							<i class="fa-solid fa-compass text-gray-500"></i>
							<span>{displayWallDirection}</span>
						</div>
					</Tooltip>
					<Tooltip text={$_('topo.sun_hours')}>
						<div
							class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100"
						>
							<i class="fa-solid fa-clock text-yellow-600"></i>
							<span>{displaySunHours}</span>
						</div>
					</Tooltip>
					{#if data.route.tags && data.route.tags.length > 0}
						{#each data.route.tags as tag}
							<span
								class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100"
							>
								{$_('tags.' + tag)}
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
						<div class="border-b border-gray-200 p-3">
							{$_('topo.climbing_type')}:
							{#if Array.isArray(data.route.type)}
								{data.route.type.map((t) => $_('types.' + t) || t).join(', ')}
							{:else}
								{$_('types.' + data.route.type) || data.route.type}
							{/if}
						</div>
					{/if}
					{#if data.route.grade}
						<div class="border-b border-gray-200 p-3">{$_('topo.grade')}: {data.route.grade}</div>
					{/if}
					{#if data.route.length}
						<div class="border-b border-gray-200 p-3">
							{$_('topo.length')}: {data.route.length} m
						</div>
					{/if}
					{#if data.route.boltAmount}
						<div class="border-b border-gray-200 p-3">
							{$_('topo.required_draws')}: {data.route.boltAmount}
						</div>
					{/if}
					{#if data.topo.rock}
						<div class="border-b border-gray-200 p-3">
							{$_('topo.rock_type')}
							: {$_('rock_types.' + data.topo.rock) || data.topo.rock}
						</div>
					{/if}
				</div>
				<div class="mt-6 w-full">
					<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">
						{$_('topo.steepness_distribution')}
					</h3>
					<div class="mb-8">
						<SteepnessDistribution metrics={routeMetrics} />
					</div>
					<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.steepness')}</h3>
					<div class="h-48 w-full mb-8">
						<RouteSteepnessChart route={data.route} on:metrics={handleMetrics} />
					</div>

					{#if sunInfo.chartData}
						<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.sun_course')}</h3>
						<div class="h-32 w-full">
							<SunChart data={sunInfo.chartData} />
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div
				class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5"
			>
				<a
					href="{base}/map/crag/{data.path}"
					class="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
					aria-label={$_('ui.back_to_map')}
				>
					<i class="fa-solid fa-arrow-left text-gray-600"></i>
				</a>
				<div class="min-w-0">
					<h1 class="truncate text-2xl font-bold my-0 text-slate-800 sm:px-2">{data.sectorId ? `${data.cragName} - ${currentSectorName}` : data.cragName}</h1>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto w-full px-8 mb-4 overflow-x-hidden min-h-0">
				<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mb-6">
					<Tooltip text={$_('topo.wall_direction')}>
						<div
							class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200"
						>
							<i class="fa-solid fa-compass text-gray-500"></i>
							<span>{displayWallDirection}</span>
						</div>
					</Tooltip>
					<Tooltip text={$_('topo.sun_hours')}>
						<div
							class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100"
						>
							<i class="fa-solid fa-clock text-yellow-600"></i>
							<span>{displaySunHours}</span>
						</div>
					</Tooltip>
					{#if data.topo.tags && data.topo.tags.length > 0}
						{#each data.topo.tags as tag}
							<span
								class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100"
							>
								{$_('tags.' + tag)}
							</span>
						{/each}
					{/if}
				</div>
				<div class="flex flex-col mt-2 mb-10">


					<!-- Stats & Description -->
					<div class="prose text-slate-800 mb-4">
						<p class="text-sm text-gray-600">{description}</p>
					</div>

					{#if data.gradeRoutes?.length || sunInfo.chartData}
						<div class="mb-8 w-full">
							{#if data.gradeRoutes?.length}
								<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">
									{$_('topo.grade_distribution')}
								</h3>
								<div class="h-32 w-full mb-6">
									<GradeChart routes={data.gradeRoutes} />
								</div>
							{/if}
							{#if seasonChartData}
								<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.seasonality')}</h3>
								<div class="h-48 w-full mb-6">
									<BestSeasonChart data={seasonChartData} />
								</div>
							{/if}
							{#if sunInfo.chartData}
								<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.sun_course')}</h3>
								<div class="h-32 w-full">
									<SunChart data={sunInfo.chartData} />
								</div>
							{/if}
						</div>
					{/if}

					<!-- Fix Points List -->
					{#if data.topo.fixPoints && data.topo.fixPoints.length > 0}
						<div class="w-full mb-8">
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.protection')}</h3>
							<div
								class="overflow-x-auto sm:rounded-xl border border-gray-200 shadow-sm bg-white p-4"
							>
								<div class="flex flex-wrap gap-2">
									{#each Object.entries(countFixPoints(data.topo.fixPoints)) as [type, count]}
										<span
											class="px-3 py-1 rounded-full bg-gray-50 text-sm font-medium text-gray-700 border border-gray-200"
										>
											{count}x {$_('topo.fixpoints.' + type) || type}
										</span>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					{#if availableSectors.length > 0 && !data.sectorId && !data.routeId}
						<div class="w-full mb-8">
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">
								{$_('ui.sectors')} ({availableSectors.length})
							</h3>
							<div class="overflow-x-auto sm:rounded-xl border border-gray-200 shadow-sm bg-white">
								<table class="min-w-full divide-y divide-gray-200 !m-0">
									<thead class="bg-gray-50">
										<tr>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
											>
												{$_('topo.table.name')}
											</th>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
											>
												{$_('topo.routes')}
											</th>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
											>
												{$_('ui.tags')}
											</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each availableSectors as sector}
											<tr
												class="hover:bg-blue-50 cursor-pointer transition-colors"
												onclick={() => goto(`${base}/topo/crag/${data.baseCragPath || data.path}/${sector.id}`)}
											>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
													<span>{sector.name}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{#if getSectorRouteCount(sector) > 0}
														<div class="flex items-center gap-3">
															<span
																class="px-2 py-1 rounded-md bg-gray-100 font-bold text-gray-700 text-xs border border-gray-300"
															>
																{getSectorRouteCount(sector)}
															</span>
															<div class="flex h-2 w-16 bg-gray-200 rounded-full overflow-hidden shrink-0">
																{#each getSectorGradeDistribution(sector) as bucket}
																	<div class="h-full {bucket.colorClass}" style="width: {bucket.percent}%" title="{bucket.label}: {bucket.count}"></div>
																{/each}
															</div>
														</div>
													{:else}
														<span class="px-2 py-1 rounded-md bg-slate-50 text-slate-500 font-bold text-xs border border-slate-200">
															{$_('topo.no_topo')}
														</span>
													{/if}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{#if getSectorTypes(sector).length > 0 || getSectorDirection(sector)}
														<div class="flex items-center gap-2 flex-wrap">
															{#each getSectorTypes(sector) as type}
																<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border {getTypeColorClass(type.id)}">
																	{type.name}
																</span>
															{/each}
															{#if getSectorDirection(sector)}
																<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
																	<i class="fa-solid fa-compass text-slate-400"></i> {getSectorDirection(sector)}
																</span>
															{/if}
														</div>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<!-- Route List -->
					<div class="w-full">
						<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">
							{$_('topo.routes')} ({data.topo.routes.length})
						</h3>
						<div class="overflow-x-auto sm:rounded-xl border border-gray-200 shadow-sm bg-white">
							<table class="min-w-full divide-y divide-gray-200 !m-0">
								<thead class="bg-gray-50">
									<tr>
										<th
											scope="col"
											class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
										>
											{$_('topo.table.name')}
										</th>
										<th
											scope="col"
											class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
										>
											{$_('topo.table.grade')}
										</th>
										<th
											scope="col"
											class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
										>
											{$_('topo.table.length')}
										</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each data.topo.routes as route}
										<tr
											class="hover:bg-blue-50 cursor-pointer transition-colors"
											onmouseenter={() => (hoveredRouteId = route.id)}
											onmouseleave={() => (hoveredRouteId = null)}
											onclick={() => {
												hoveredRouteId = null;
												goto(base + '/topo/crag/' + data.path + '/' + route.id);
											}}
										>
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{route.name}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm">
												<span
													class="px-2 py-1 rounded-md bg-gray-100 font-bold text-gray-700 text-xs border border-gray-300"
												>
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

{#if !isTopoLegendOpen && displayMode === '2d'}
	<button
		type="button"
		class="fixed right-4 top-5 z-[30000] grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white text-sm text-black shadow-sm transition-transform hover:scale-105 sm:bottom-7 sm:left-7 sm:right-auto sm:top-auto"
		onclick={() => (isTopoLegendOpen = true)}
		aria-label="Open topo legend"
		title="Topo legend"
	>
		<i class="fa-solid fa-map-signs"></i>
	</button>
{/if}

<TopoLegend
	open={isTopoLegendOpen}
	usedTypes={usedTopoSymbolTypes}
	onClose={() => (isTopoLegendOpen = false)}
/>

<style>
	:global(.route-label) {
		background-color: rgba(255, 255, 255, 0.9);
		color: black;
		padding: 4px 8px;
		border-radius: 5px;
		font-size: 11px;
		font-weight: bold;
		font-family: sans-serif;
		white-space: nowrap;
		text-align: center;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	@media (min-width: 768px) {
		.topo-container {
			-webkit-mask-image: linear-gradient(to right, black 98%, transparent 100%);
			mask-image: linear-gradient(to right, black 98%, transparent 100%);
		}
	}

	.transition-transform {
		transition: transform 0.3s ease-in-out;
	}

	.rotate-180 {
		transform: rotate(180deg);
	}
</style>
