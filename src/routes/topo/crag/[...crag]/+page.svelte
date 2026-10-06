<script lang="ts">
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls, useProgress } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Box3, Sphere, TOUCH, Vector3, WebGLRenderer } from 'three';
	import Model from '$lib/components/topo/Model.svelte';
	import RouteLine from '$lib/components/topo/RouteLine.svelte';
	import CssObject from '$lib/components/topo/CssObject.svelte';
	import Topo2DViewer from '$lib/components/topo/Topo2DViewer.svelte';
	import TopoLegend from '$lib/components/topo/TopoLegend.svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { _, locale } from 'svelte-i18n';
	import { browser } from '$app/environment';

	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import {
		calculateSunInfo,
		calculateSunPositionVector,
		calculateWallDirection
	} from '$lib/assets/js/sun-calculations';
	import { getTypeColorClass } from '$lib/assets/js/route-types.js';
	import { getAccessTracks, getRouteTracks } from '$lib/assets/js/route-gpx.js';
	import RouteGpxDownload from '$lib/components/topo/RouteGpxDownload.svelte';
	import SceneSetup from '$lib/components/topo/SceneSetup.svelte';
	import type { Route, Point3D, Grade } from '@vorstieg/fels-types/types';
	import type {
		RouteId,
		SelectedClimbingLine,
		VisualClimbingLine,
		SunInfo,
		CameraAnimation,
		SteepnessMetrics
	} from '$lib/types/application';
	import type { PerspectiveCamera } from 'three';
	import type { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { findRouteOrChild } from '$lib/assets/js/topo-loader-utils.js';
	import { getTypeColor } from '$lib/assets/js/route-types.js';
	import { colors } from '$lib/colors.js';

	import SteepnessDistribution from '$lib/components/charts/SteepnessDistribution.svelte';
	import RouteSteepnessChart from '$lib/components/charts/RouteSteepnessChart.svelte';
	import FloatingControlsBottom from '$lib/components/ui/FloatingControlsBottom.svelte';
	import FloatingControlsTop from '$lib/components/ui/FloatingControlsTop.svelte';
	import FloatingButton from '$lib/components/ui/FloatingButton.svelte';
	import GradeLine from '$lib/components/charts/GradeLine.svelte';
	import RouteList from '$lib/components/topo/RouteList.svelte';

	let { data }: { data: import('./$types').PageData } = $props();
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
	let currentSectorName = $derived(data.sector?.properties.name || data.sectorId);
	let availableSectors = $derived(data.sectors);

	function openChildEntry(child: import('$lib/types/files').FelsLocation) {
		const hasTopo = data.sectorTopos.some(
			(item) => item.sectorId === child.entry.properties.id && item.topo
		);
		goto(
			`${base}/${hasTopo ? 'topo' : 'map'}/crag/${child.path}${hasTopo ? $page.url.search : ''}`
		);
	}

	let routeMetrics = $state<SteepnessMetrics | null>(null);
	let sunInfo = $state<SunInfo>({ hours: 'Calculating...', chartData: null });

	let wallDirection = $state('Unknown');
	let isCameraMoving = $state(false);
	let camera = $state<PerspectiveCamera>();

	let controls = $state<ThreeOrbitControls>();
	// Daylight Simulation State
	let isDaylightSimulation = $state(false);
	let simulationTime = $state(12); // Hours (0-24)
	let simulationDate = $state(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
	const shadowMapSize = $derived<[number, number]>(
		browser && window.innerWidth < 768 ? [1024, 1024] : [4096, 4096]
	);

	const { progress: progressStore } = useProgress();
	let progress = $state(0);
	let modelLoaded = $state(false);
	let initialLoadComplete = $state(false);

	let isSlowNetwork = $state(false);
	let forceHighRes = $state(false);
	let displayModeMenuOpen = $state(false);

	let infoPanelComponent = $state<{ moveToLowest: () => void }>();
	let isInfoPanelOpen = $state(true);
	$effect(() => {
		// Ensure panel re-opens whenever navigation occurs
		$page.url;
		isInfoPanelOpen = true;
	});

	function handleRouteClicked() {
		isInfoPanelOpen = true;
	}

	$effect(() => {
		if (modelLoaded) {
			initialLoadComplete = true;
		}
	});

	$effect(() => {
		if (browser && navigator.connection) {
			const conn = navigator.connection;
			if (
				conn.saveData ||
				conn.effectiveType === 'slow-2g' ||
				conn.effectiveType === '2g' ||
				conn.effectiveType === '3g' ||
				conn.type === 'cellular'
			) {
				isSlowNetwork = true;
			}
		}
	});

	let activeModelUrl = $derived(
		data.lowResModelUrl && !forceHighRes ? data.lowResModelUrl : data.modelUrl
	);

	let has3D = $derived(data.has3D);
	let has2D = $derived(
		!!data.topo.image2D ||
			data.topo.routes.some(
				(r) =>
					r.points2D?.length ||
					r.pitches?.some((pitch) => pitch.points2D?.length) ||
					r.variants?.some((variant) => variant.points2D?.length)
			) ||
			data.topo.outlines?.length ||
			data.topo.fixPoints?.some((fp) => fp.position2D) ||
			data.topo.textLabels?.some((label) => label.position2D)
	);
	let displayMode = $state('3d');
	let isTopoLegendOpen = $state(false);
	let usedTopoSymbolTypes = $derived(
		Array.from(
			new Set(
				(data.route?.fixPoints
					? data.topo.fixPoints?.filter(
							(fp) => fp.position !== undefined && data.route?.fixPoints?.includes(fp.id)
						)
					: data.topo.fixPoints
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

	let animationState = $state<CameraAnimation | null>(null);

	function getParentRoute(childId: RouteId | null | undefined) {
		return data.topo.routes.find(
			(r) =>
				r.id === childId ||
				(r.pitches && r.pitches.some((p) => p.id === childId)) ||
				(r.variants && r.variants.some((variant) => variant.id === childId))
		);
	}

	let referencedTracks = $derived(
		getRouteTracks(data.topo, getParentRoute(data.route?.id) || data.route)
	);
	let fallbackAccessTracks = $derived(getAccessTracks(data.access));

	function getCameraOffset(radius: number) {
		const offset = new Vector3();
		if (typeof window === 'undefined') return offset;
		if (window.innerWidth < 768) {
			offset.set(0, -Math.max(radius * 0.4, 2), 0); // Mobile: Move camera down relative to size
		} else {
			offset.set(Math.max(radius * 0.6, 3), 0, 0); // Desktop: Move camera right relative to size
		}
		return offset;
	}

	function applyOffsetToTarget(targetPos: Vector3, center: Vector3, radius: number) {
		if (!camera) return { newPos: targetPos, newCenter: center };
		const tempCamera = camera.clone();
		tempCamera.position.copy(targetPos);
		tempCamera.lookAt(center);
		tempCamera.updateMatrixWorld();

		const offset = getCameraOffset(radius);
		tempCamera.translateX(offset.x);
		tempCamera.translateY(offset.y);

		const worldOffset = tempCamera.position.clone().sub(targetPos);

		return {
			newPos: tempCamera.position.clone(),
			newCenter: center.clone().add(worldOffset)
		};
	}

	function focusOverview() {
		if (!controls || !camera || data.topo.routes.length === 0) return;

		let points: Point3D[] = [];
		let orientations: Vector3[] = [];

		data.topo.routes.forEach((r) => {
			if (r.type === 'multi-pitch' && r.pitches) {
				r.pitches.forEach((p) => {
					if (p.points) points.push(...p.points);
				});
			} else if (r.points) {
				points.push(...r.points);
			}
			if (r.orientation) orientations.push(new Vector3(...r.orientation));
		});

		if (points.length === 0) return;

		const box = new Box3();
		points.forEach((p) => box.expandByPoint(new Vector3(p[0], p[1], p[2])));
		const center = new Vector3();
		box.getCenter(center);

		const sphere = new Sphere();
		box.getBoundingSphere(sphere);

		let avgOrientation = new Vector3(0, 0, 1);
		if (orientations.length > 0) {
			avgOrientation.set(0, 0, 0);
			orientations.forEach((o) => avgOrientation.add(o));
			avgOrientation.normalize();
		}
		if (avgOrientation.lengthSq() === 0) avgOrientation.set(0, 0, 1);

		const fov = 75 * (Math.PI / 180);
		const dist = (sphere.radius * 1.4) / Math.sin(fov / 2);
		const finalDist = Math.max(dist, 10);

		const baseTargetPos = center.clone().add(avgOrientation.multiplyScalar(finalDist));
		const { newPos, newCenter } = applyOffsetToTarget(baseTargetPos, center, sphere.radius);

		camera.position.copy(newPos);
		controls.target.copy(newCenter);
		controls.update();
	}

	function focusRoute(route: SelectedClimbingLine) {
		if (!route || !controls || !camera) return;

		// 1. Collect points
		let points: Point3D[] = [];
		if (route.type === 'multi-pitch' && route.pitches) {
			route.pitches.forEach((p) => {
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
		const fov = 75 * (Math.PI / 180);
		const dist = (sphere.radius * 1.2) / Math.sin(fov / 2);
		const finalDist = Math.max(dist, 5);

		const baseTargetPos = center.clone().add(orientation.multiplyScalar(finalDist));
		const { newPos, newCenter } = applyOffsetToTarget(baseTargetPos, center, sphere.radius);

		// 5. Start Animation
		if (camera) {
			isProgrammaticAnimationRunning = true;
			animationState = {
				startPos: camera.position.clone(),
				endPos: newPos,
				startTarget: controls.target.clone(),
				endTarget: newCenter,
				startTime: Date.now(),
				duration: 1000
			};
		}
	}

	let lastFocusedRouteId = $state<RouteId | null>(null);
	let hoveredRouteId = $state<RouteId | null>(null);
	let isProgrammaticAnimationRunning = $state(false);

	$effect(() => {
		if (
			activeRouteId != null &&
			modelLoaded &&
			!isCameraMoving &&
			activeRouteId !== lastFocusedRouteId
		) {
			lastFocusedRouteId = activeRouteId;
			hoveredRouteId = null;

			let routeToFocus = data.route?.id === activeRouteId ? data.route : null;
			if (!routeToFocus && data.topo && data.topo.routes) {
				for (const r of data.topo.routes) {
					if (r.id === activeRouteId) {
						routeToFocus = r;
						break;
					}
					if (r.pitches) {
						const pitch = r.pitches.find((p) => p.id === activeRouteId);
						if (pitch) {
							routeToFocus = { ...pitch, orientation: r.orientation };
							break;
						}
					}
				}
			}

			if (routeToFocus) focusRoute(routeToFocus);
		} else if (activeRouteId == null && lastFocusedRouteId != null) {
			lastFocusedRouteId = null;
		}
	});

	$effect(() => {
		if (hoveredRouteId && modelLoaded && !isCameraMoving) {
			const r = data.topo.routes.find((r) => r.id === hoveredRouteId);
			if (r) focusRoute(r);
		}
	});

	$effect(() => {
		if (isCameraMoving && animationState) {
			animationState = null;
			isProgrammaticAnimationRunning = false;
		}
	});

	let renderChartsStage = $state(0);
	$effect(() => {
		if (!isProgrammaticAnimationRunning && data.route) {
			renderChartsStage = 1;
			setTimeout(() => {
				if (!isProgrammaticAnimationRunning) renderChartsStage = 2;
			}, 50);
			setTimeout(() => {
				if (!isProgrammaticAnimationRunning) renderChartsStage = 3;
			}, 100);
		} else {
			renderChartsStage = 0;
		}
	});

	$effect(() => {
		const unsubscribe = progressStore.subscribe((value) => {
			progress = value;
		});
		return unsubscribe;
	});

	let pendingRouteId = $derived(
		$navigating?.to?.url.pathname.startsWith(base + '/topo/crag/')
			? (findRouteOrChild(data.topo.routes, $navigating.to.url.pathname.split('/').pop() ?? '')
					?.id ?? null)
			: null
	);

	let isNavigatingAway = $derived(
		!!(
			$navigating &&
			$navigating.to &&
			!$navigating.to.url.pathname.startsWith(base + '/topo/crag/')
		)
	);

	let activeRouteId = $derived(pendingRouteId ?? data.route?.id);

	let description = $derived(
		$locale === 'de' ? data.description_de : data.description_en || data.description_de
	);
	let displayWallDirection = $derived(
		wallDirection !== 'Unknown' ? $_('directions.' + wallDirection) : wallDirection
	);
	let displaySunHours = $derived(
		sunInfo.hours === 'shade_all_day' || sunInfo.hours === 'no_geodata'
			? $_('sun.' + sunInfo.hours)
			: sunInfo.hours
	);

	let sunLightPosition: Point3D = $derived.by(() => {
		if (!isDaylightSimulation) return [5, 10, 7];

		let lat = 47;
		let lng = 11;
		if (data.topo && data.topo.coordinates && data.topo.coordinates) {
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

	let visualRoutes = $state<VisualClimbingLine[]>([]);
	let lastTopoPath = '';

	$effect(() => {
		const currentPath = data?.path;
		const topoRoutes = data.topo.routes;

		if (!topoRoutes) {
			lastTopoPath = '';
			visualRoutes = [];
			return;
		}

		if (currentPath === lastTopoPath) {
			// Cache hit: navigating between routes on the same crag
			return;
		}

		lastTopoPath = currentPath;
		visualRoutes = topoRoutes.flatMap((route) => {
			if (route.type === 'multi-pitch' && route.pitches) {
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

	$effect(() => {
		if (data.topo) {
			sunInfo = calculateSunInfo(data.topo, data.route);
			wallDirection = calculateWallDirection(data.topo, data.route);
		}
	});
	let hasInitializedCamera = $state(false);

	$effect(() => {
		if (!camera) {
			hasInitializedCamera = false;
			modelLoaded = false;
		}
	});

	$effect(() => {
		if (modelLoaded && camera && controls && !hasInitializedCamera) {
			hasInitializedCamera = true;
			if (activeRouteId == null) {
				focusOverview();
			}
		}
	});

	$effect(() => {
		if (!controls || !camera || !hasInitializedCamera) return;

		let resizeTimeout: ReturnType<typeof setTimeout>;
		const handleResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				if (activeRouteId != null) {
					const r = data.topo.routes.find((route) => route.id === activeRouteId);
					if (r) focusRoute(r);
				} else {
					focusOverview();
				}
			}, 100);
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			clearTimeout(resizeTimeout);
		};
	});

	async function share() {
		if (navigator.share) {
			try {
				await navigator.share({
					title: data.name || $_('site.title'),
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

	function handleMetrics(event: CustomEvent<SteepnessMetrics>) {
		routeMetrics = event.detail;
	}

	const createRenderer = (canvas: HTMLCanvasElement) => {
		return new WebGLRenderer({
			canvas,
			powerPreference: 'high-performance',
			antialias: true,
			precision: 'highp',
			alpha: true
		});
	};

	function getGradeColor(grade: Grade | undefined) {
		if (!grade) return colors.topo.gradeUnknown;
		const g = grade.standardizedValue;
		if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) return colors.topo.gradeEasy;
		if (g.startsWith('6')) return colors.topo.gradeMedium;
		if (g.startsWith('7')) return colors.topo.gradeHard;
		if (g.startsWith('8') || g.startsWith('9')) return colors.topo.gradeVeryHard;
		return colors.topo.gradeUnknown;
	}

	function getSectorRouteCount(sector: import('$lib/types/files').FelsLocation) {
		return (data.gradeRoutes ?? []).filter((route) => route.sectorId === sector.entry.properties.id)
			.length;
	}

	function getSectorGradeDistribution(sector: import('$lib/types/files').FelsLocation) {
		const routes = data.gradeRoutes?.filter((r) => r.sectorId === sector.entry.properties.id) || [];
		if (routes.length === 0) return [];

		let easy = 0,
			medium = 0,
			hard = 0,
			veryHard = 0;
		routes.forEach((r) => {
			const g = r.grade?.standardizedValue ?? '';
			if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) easy++;
			else if (g.startsWith('6')) medium++;
			else if (g.startsWith('7')) hard++;
			else if (g.startsWith('8') || g.startsWith('9')) veryHard++;
		});

		const total = easy + medium + hard + veryHard;
		if (total === 0) return [];

		return [
			{ count: easy, percent: (easy / total) * 100, colorClass: 'bg-green-400', label: '< 6a' },
			{
				count: medium,
				percent: (medium / total) * 100,
				colorClass: 'bg-yellow-400',
				label: '6a - 6c+'
			},
			{
				count: hard,
				percent: (hard / total) * 100,
				colorClass: 'bg-orange-500',
				label: '7a - 7c+'
			},
			{
				count: veryHard,
				percent: (veryHard / total) * 100,
				colorClass: 'bg-fuchsia-500',
				label: '> 8a'
			}
		].filter((b) => b.count > 0);
	}

	function getSectorDirection(sector: import('$lib/types/files').FelsLocation) {
		const routes = (data.gradeRoutes ?? []).filter(
			(route) => route.sectorId === sector.entry.properties.id
		);
		const topo = data.sectorTopos.find(
			(item) => item.sectorId === sector.entry.properties.id
		)?.topo;
		const direction = calculateWallDirection(
			topo ?? { routes, wallAzimuth: routes[0]?.sectorWallAzimuth }
		);
		return direction === 'Unknown' ? null : $_('directions.' + direction);
	}

	function getSectorTypes(sector: import('$lib/types/files').FelsLocation) {
		return (sector.entry.properties.type ?? []).map((id) => {
			const translated = $_('tags.' + id);
			return { id, name: translated === 'tags.' + id ? id : translated };
		});
	}
</script>

<svelte:window onroute-clicked={handleRouteClicked} />

<div
	class="topo-container top-0 left-0 h-screen w-screen {isInfoPanelOpen
		? 'topo-container-fade md:w-3/4'
		: 'md:w-full'} pointer-events-auto absolute overflow-hidden transition-all duration-300"
>
	{#if mounted}
		{#if displayMode === '2d' && has2D}
			<Topo2DViewer
				topo={data.topo}
				routes={data.topo.routes}
				selectedRouteId={getParentRoute(activeRouteId)?.id ?? activeRouteId}
				onRouteSelect={(route: Route) =>
					goto(base + '/topo/crag/' + data.path + '/' + route.id + $page.url.search)}
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
							class="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-200 bg-white/80 shadow-sm backdrop-blur-sm"
							title={$_('ui.sun')}
						>
							<i class="fa-solid fa-sun text-xl text-yellow-600"></i>
						</div>
					</CssObject>
					<T.ArrowHelper args={[sunDirectionVec3, sunPositionVec3, 2, 0xfdb813, 0.5, 0.25]} />
				{/if}

				<Model modelUrl={activeModelUrl} onload={() => (modelLoaded = true)} />
				{#if data.lowResModelUrl && !isSlowNetwork && !forceHighRes && modelLoaded}
					<Model
						modelUrl={data.modelUrl}
						visible={false}
						onload={() => {
							forceHighRes = true;
						}}
					/>
				{/if}

				{#if visualRoutes && initialLoadComplete}
					{#each visualRoutes as route (route.id)}
						<RouteLine
							link={base +
								'/topo/crag/' +
								data.path +
								'/' +
								(route.parentId ?? route.id) +
								$page.url.search}
							points={route.points}
							name={route.name}
							grade={route.grade}
							color={activeRouteId != null &&
							(activeRouteId === route.id || activeRouteId === route.parentId)
								? colors.topo.routeHover
								: getGradeColor(route.grade)}
							width={activeRouteId != null &&
							(activeRouteId === route.id || activeRouteId === route.parentId)
								? 0.1
								: 0.08}
							isSelected={activeRouteId != null &&
								(activeRouteId === route.id || activeRouteId === route.parentId)}
							{isCameraMoving}
							isHoveredExternally={hoveredRouteId === (route.parentId ?? route.id)}
						/>
					{/each}
				{/if}

				{#if data.topo.fixPoints && initialLoadComplete && data.route}
					{#each data.topo.fixPoints.filter((fp) => fp.position !== undefined && data.route?.fixPoints?.includes(fp.id)) as point}
						<CssObject position={point.position}>
							{#if point.type === 'anchor'}
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full border border-orange-200 bg-white/80 shadow-sm backdrop-blur-sm"
									title={$_('topo.fixpoints.anchor')}
								>
									<i class="fa-solid fa-anchor text-xs text-orange-500"></i>
								</div>
							{:else if point.type === 'piton'}
								<div
									class="flex h-4 w-4 items-center justify-center rounded-full border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm"
									title={$_('topo.fixpoints.piton')}
								>
									<i class="fa-solid fa-thumb-tack text-[10px] text-gray-500"></i>
								</div>
							{:else if point.type === 'hourglass'}
								<div
									class="flex h-4 w-4 items-center justify-center rounded-full border border-yellow-200 bg-white/80 shadow-sm backdrop-blur-sm"
									title={$_('topo.fixpoints.hourglass')}
								>
									<i class="fa-solid fa-hourglass-half text-[10px] text-yellow-600"></i>
								</div>
							{:else}
								<div
									class="flex h-3 w-3 items-center justify-center rounded-full border border-red-200 bg-white/80 shadow-sm backdrop-blur-sm"
									title={$_('topo.fixpoints.bolt')}
								>
									<div class="h-1.5 w-1.5 rounded-full bg-red-500"></div>
								</div>
							{/if}
						</CssObject>
					{/each}
				{/if}

				<SceneSetup
					bind:animation={animationState}
					{controls}
					onAnimationEnd={() => {
						isProgrammaticAnimationRunning = false;
					}}
				/>
			</Canvas>
		{/if}
	{/if}
</div>

<main class="z-[500] h-24">
	{#snippet hdButton()}
		{#if displayMode === '3d' && data.lowResModelUrl}
			{#if progress < 1 && (forceHighRes || (!isSlowNetwork && modelLoaded))}
				<div
					class="pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-2xl border-1 border-gray-200 bg-white shadow-md max-sm:h-11 max-sm:w-11"
				>
					<div
						class="absolute h-6 w-6 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600 max-sm:h-7 max-sm:w-7"
					></div>
					<span class="z-10 text-[10px] font-bold text-blue-600 max-sm:text-[12px]">HD</span>
				</div>
			{:else if !forceHighRes && isSlowNetwork}
				<FloatingButton
					icon="fa-download"
					title={$_('topo.load_high_res_title') || 'Load High-Res 3D Model'}
					onclick={() => (forceHighRes = true)}
				/>
			{/if}
		{/if}
	{/snippet}

	{#snippet sunButton()}
		{#if displayMode === '3d'}
			<div
				class="flex flex-row items-center justify-start gap-2 max-sm:w-full max-sm:flex-row-reverse"
			>
				<FloatingButton
					icon="fa-sun"
					title="Daylight Simulator"
					active={isDaylightSimulation}
					activeClasses="bg-yellow-100 text-yellow-600 border-yellow-300"
					onclick={() => (isDaylightSimulation = !isDaylightSimulation)}
				/>
				{#if isDaylightSimulation}
					<div
						transition:slide={{ axis: 'x', duration: 300 }}
						class="pointer-events-auto flex min-w-[200px] flex-1 flex-row items-center rounded-2xl border-1 border-gray-200 bg-white/90 backdrop-blur max-sm:p-3 max-sm:shadow-lg sm:h-10 sm:px-2 sm:py-1 sm:shadow-sm"
					>
						<input
							type="date"
							value={simulationDate}
							oninput={(e) => (simulationDate = e.currentTarget.value)}
							class="w-24 shrink-0 cursor-pointer border-none bg-transparent text-center font-mono text-xs font-bold text-gray-500 outline-none"
						/>
						<div class="mx-2 h-6 w-px shrink-0 bg-gray-300"></div>
						<div class="flex min-w-0 flex-1 items-center gap-2">
							<span class="w-10 shrink-0 text-right font-mono text-xs font-bold text-gray-500">
								{Math.floor(simulationTime)}:{Math.floor((simulationTime % 1) * 60)
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
								class="h-1.5 w-full min-w-0 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-yellow-500"
							/>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}

	<div
		class="pointer-events-none fixed top-2 right-0 left-0 z-[1000] h-fit overflow-visible py-2 sm:top-3 sm:w-auto"
	>
		<div
			class="pointer-events-auto mx-4 sm:mx-0 sm:ml-8 sm:w-[30vw] sm:max-w-64 md:max-w-72 lg:max-w-80"
		>
			<div class="pointer-events-auto flex h-[50px] items-center sm:h-[40px]">
				<FloatingButton
					class="w-auto gap-2 px-4 text-sm font-bold"
					icon="fa-arrow-left"
					title={$_('ui.to_map')}
					href="{base}/map/crag/{data.path}"
				>
					<span>{$_('ui.to_map')}</span>
				</FloatingButton>
			</div>
		</div>
	</div>

	<FloatingControlsTop>
		{#if has2D && has3D}
			<div
				class="pointer-events-auto flex flex-col items-end gap-2 sm:items-start"
				role="group"
				aria-label="Topo display mode"
				onmouseleave={() => (displayModeMenuOpen = false)}
			>
				<FloatingButton
					icon="fa-map"
					title="Choose topo display mode"
					onmouseenter={() => (displayModeMenuOpen = true)}
					onfocus={() => (displayModeMenuOpen = true)}
					onclick={() => (displayModeMenuOpen = !displayModeMenuOpen)}
				/>
				{#if displayModeMenuOpen}
					<div
						class="z-0 flex flex-col justify-center gap-2"
						transition:slide={{ duration: 200, axis: 'y' }}
					>
						<button
							class="hover:bg-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 bg-white text-[12px] font-bold text-gray-600 shadow-md hover:text-white max-sm:h-11 max-sm:w-11 max-sm:text-[14px] {displayMode ===
							'3d'
								? 'border-blue-200 bg-blue-50 text-blue-600'
								: ''}"
							onclick={() => {
								displayModeMenuOpen = false;
								const url = new URL($page.url.href);
								url.searchParams.set('mode', '3d');
								goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
							}}
						>
							3D
						</button>
						<button
							class="hover:bg-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 bg-white text-[12px] font-bold text-gray-600 shadow-md hover:text-white max-sm:h-11 max-sm:w-11 max-sm:text-[14px] {displayMode ===
							'2d'
								? 'border-blue-200 bg-blue-50 text-blue-600'
								: ''}"
							onclick={() => {
								displayModeMenuOpen = false;
								const url = new URL($page.url.href);
								url.searchParams.set('mode', '2d');
								goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
							}}
						>
							2D
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div class="pointer-events-auto hidden flex-col items-start gap-2 sm:flex">
			{#if !isInfoPanelOpen}
				<FloatingButton
					icon="fa-info-circle"
					title="Show Info"
					onclick={() => (isInfoPanelOpen = true)}
				/>
			{/if}
			{#if displayMode === '2d' && !isTopoLegendOpen}
				<FloatingButton
					icon="fa-map-signs"
					title="Topo legend"
					onclick={() => (isTopoLegendOpen = true)}
				/>
			{/if}
			{@render hdButton()}
			{@render sunButton()}
		</div>
		<div class="pointer-events-auto hidden sm:flex">
			<TopoLegend
				open={isTopoLegendOpen}
				usedTypes={usedTopoSymbolTypes}
				onClose={() => (isTopoLegendOpen = false)}
			/>
		</div>
	</FloatingControlsTop>

	<FloatingControlsBottom>
		<div
			class="flex w-full flex-col items-end gap-2 transition-opacity duration-300 sm:hidden {isNavigatingAway
				? 'opacity-0'
				: 'opacity-100'}"
		>
			{#if !isInfoPanelOpen}
				<FloatingButton
					icon="fa-info-circle"
					title="Show Info"
					onclick={() => (isInfoPanelOpen = true)}
				/>
			{/if}
			{#if displayMode === '2d' && !isTopoLegendOpen}
				<FloatingButton
					icon="fa-map-signs"
					title="Topo legend"
					onclick={() => (isTopoLegendOpen = true)}
				/>
			{/if}
			{@render hdButton()}
			{@render sunButton()}
		</div>
		<div class="pointer-events-auto flex w-full justify-end sm:hidden">
			<TopoLegend
				open={isTopoLegendOpen}
				usedTypes={usedTopoSymbolTypes}
				onClose={() => (isTopoLegendOpen = false)}
			/>
		</div>
	</FloatingControlsBottom>

	<InfoPanel
		bind:this={infoPanelComponent}
		onShare={share}
		isOpen={isInfoPanelOpen && !isNavigatingAway}
		onClose={() => (isInfoPanelOpen = false)}
	>
		<div class="flex h-full min-h-0 w-full flex-1 flex-col">
			{#if $navigating && $navigating.to?.url.pathname.startsWith(base + '/topo/crag/')}
				<div class="mt-6 mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-6">
					<div class="flex animate-pulse flex-col space-y-4 pt-4">
						<div class="mb-4 h-8 w-1/2 rounded-lg bg-gray-200"></div>
						<div class="mb-4 flex gap-2">
							<div class="h-8 w-24 rounded-lg bg-gray-200"></div>
							<div class="h-8 w-24 rounded-lg bg-gray-200"></div>
							<div class="h-8 w-20 rounded-lg bg-gray-200"></div>
						</div>
						<div class="h-4 w-5/6 rounded bg-gray-200"></div>
						<div class="h-4 w-3/4 rounded bg-gray-200"></div>
						<div class="h-4 w-1/2 rounded bg-gray-200"></div>
						<div class="mt-6 h-40 w-full rounded-2xl bg-gray-200"></div>
					</div>
				</div>
			{:else if data.route}
				<div
					class="flex w-screen flex-row items-center justify-self-center px-6 pt-6 pr-20 pb-5 sm:w-auto sm:justify-self-start"
				>
					<a
						href="{base}/topo/crag/{data.path}{$page.url.search}"
						class="mr-3 rounded-full p-2 transition-colors hover:bg-gray-100"
						aria-label={$_('ui.back_to_topo')}
					>
						<i class="fa-solid fa-arrow-left text-gray-600"></i>
					</a>
					<div class="min-w-0">
						<div class="flex items-center gap-3">
							<h1 class="my-0 truncate text-2xl font-bold text-slate-800">{data.route.name}</h1>
							{#if data.route.grade}
								<span
									class="shrink-0 rounded-md bg-gray-100 px-5 py-1 text-sm font-bold text-gray-700 shadow-sm"
									style="border-left: 5px solid {getGradeColor(data.route.grade)};"
								>
									{data.route.grade?.value ?? ''}
								</span>
							{/if}
							{#if referencedTracks.length}
								<RouteGpxDownload
									route={data.route}
									tracks={referencedTracks}
									{fallbackAccessTracks}
								/>
							{/if}
						</div>
						{#if data.isSectorPath}
							<div class="mt-1 flex items-center gap-2">
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

				<div class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-6" overflow-y>
					<div class="mb-6 flex flex-wrap gap-3 text-sm font-medium text-gray-700">
						{#if data.route.type}
							{#each [data.route.type] as t}
								<span
									class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-white"
									style="background-color: {getTypeColor(t) + 'd9'};"
								>
									{$_('types.' + t)}
								</span>
							{/each}
						{/if}
						{#if data.route.tags && data.route.tags.length > 0}
							{#each data.route.tags as tag}
								<span
									class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
									style="background-color: #64748bd9;"
								>
									{$_('tags.' + tag)}
								</span>
							{/each}
						{/if}
						{#if wallDirection !== 'N/A' && wallDirection !== 'Unknown'}
							<Tooltip text={$_('topo.wall_direction')}>
								<div class="mt-1 ml-2 flex items-center gap-1.5 text-slate-700">
									<i class="fa-solid fa-compass"></i>
									<span>{displayWallDirection}</span>
								</div>
							</Tooltip>
						{/if}
						{#if sunInfo.hours !== 'N/A' && sunInfo.hours !== 'Unknown' && sunInfo.hours !== 'no_geodata'}
							<Tooltip text={$_('topo.sun_hours')}>
								<div class="mt-1 ml-2 flex items-center gap-1.5 text-slate-700">
									<i class="fa-solid fa-clock"></i>
									<span>{displaySunHours}</span>
								</div>
							</Tooltip>
						{/if}
					</div>
					<div class="prose mx-auto mb-5">
						{#if data.route.description}
							<div class="border-b border-gray-200 p-3">
								{data.route.description}
							</div>
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
						{#if data.rockType}
							<div class="border-b border-gray-200 p-3">
								{$_('topo.rock_type')}
								: {$_('rock_types.' + data.rockType) || data.rockType}
							</div>
						{/if}
					</div>
					{#if data.route?.points?.length}
						<div class="mt-6 min-h-[400px] w-full">
							{#if !isProgrammaticAnimationRunning && renderChartsStage >= 1}
								<div in:slide={{ duration: 200 }}>
									<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
										{$_('topo.steepness_distribution')}
									</h3>
									<div class="mb-8">
										<SteepnessDistribution metrics={routeMetrics} />
									</div>
								</div>
							{/if}
							{#if !isProgrammaticAnimationRunning && renderChartsStage >= 2}
								<div in:slide={{ duration: 200 }}>
									<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.steepness')}</h3>
									<div class="mb-8 h-48 w-full">
										<RouteSteepnessChart route={data.route} on:metrics={handleMetrics} />
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<div
					class="flex w-screen flex-row items-center justify-self-center px-6 pt-6 pr-20 pb-5 sm:w-auto sm:justify-self-start"
				>
					<div class="min-w-0">
						<h1 class="my-0 truncate text-2xl font-bold text-slate-800">
							{data.sectorId ? `${data.cragName} - ${currentSectorName}` : data.cragName}
						</h1>
					</div>
				</div>

				<div class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-6" overflow-y>
					<div class="mb-6 flex flex-wrap gap-3 text-sm font-medium text-gray-700">
						{#each data.sector?.properties.type ?? data.cragType ?? [] as type}
							<span
								class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-white"
								style="background-color: {getTypeColor(type) + 'd9'};"
							>
								{$_('types.' + type)}
							</span>
						{/each}
						{#if data.topo.tags && data.topo.tags.length > 0}
							{#each data.topo.tags as tag}
								<span
									class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
									style="background-color: #64748bd9;"
								>
									{$_('tags.' + tag)}
								</span>
							{/each}
						{/if}
						{#if wallDirection !== 'N/A' && wallDirection !== 'Unknown'}
							<Tooltip text={$_('topo.wall_direction')}>
								<div class="mt-1 ml-2 flex items-center gap-1.5 text-slate-700">
									<i class="fa-solid fa-compass"></i>
									<span>{displayWallDirection}</span>
								</div>
							</Tooltip>
						{/if}
						{#if sunInfo.hours !== 'N/A' && sunInfo.hours !== 'Unknown' && sunInfo.hours !== 'no_geodata'}
							<Tooltip text={$_('topo.sun_hours')}>
								<div class="mt-1 ml-2 flex items-center gap-1.5 text-slate-700">
									<i class="fa-solid fa-clock"></i>
									<span>{displaySunHours}</span>
								</div>
							</Tooltip>
						{/if}
					</div>
					<div class="mt-2 mb-10 flex flex-col">
						<!-- Stats & Description -->
						<div class="prose mb-4 text-slate-800">
							<p class="text-sm text-gray-600">{description}</p>
						</div>

						{#if data.gradeRoutes?.length || sunInfo.chartData}
							<div class="mb-8 w-full">
								{#if data.gradeRoutes?.length >= 2}
									<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
										{$_('topo.grade_distribution')}
									</h3>
									<div class="mb-6 w-full">
										<GradeLine routes={data.gradeRoutes} />
									</div>
								{/if}
							</div>
						{/if}

						{#if availableSectors.length > 0}
							<div class="mb-8 w-full">
								<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
									{$_(
										availableSectors.every((item) => item.entry.properties.kind === 'sector')
											? 'ui.sectors'
											: 'ui.locations'
									)} ({availableSectors.length})
								</h3>
								<div
									class="overflow-x-auto border border-gray-200 bg-white shadow-sm sm:rounded-xl"
								>
									<table class="!m-0 min-w-full divide-y divide-gray-200">
										<thead class="bg-gray-50">
											<tr>
												<th
													scope="col"
													class="px-6 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase"
												>
													{$_('topo.table.name')}
												</th>
												<th
													scope="col"
													class="px-6 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase"
												>
													{$_('topo.routes')}
												</th>
												<th
													scope="col"
													class="px-6 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase"
												>
													{$_('ui.tags')}
												</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray-200 bg-white">
											{#each availableSectors as sector}
												<tr
													class="cursor-pointer transition-colors hover:bg-blue-50"
													onclick={() => openChildEntry(sector)}
												>
													<td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
														<span>{sector.entry.properties.name}</span>
													</td>
													<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
														{#if getSectorRouteCount(sector) > 0}
															<div class="flex items-center gap-3">
																<span
																	class="rounded-md border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700"
																>
																	{getSectorRouteCount(sector)}
																</span>
																<div
																	class="flex h-2 w-16 shrink-0 overflow-hidden rounded-full bg-gray-200"
																>
																	{#each getSectorGradeDistribution(sector) as bucket}
																		<div
																			class="h-full {bucket.colorClass}"
																			style="width: {bucket.percent}%"
																			title="{bucket.label}: {bucket.count}"
																		></div>
																	{/each}
																</div>
															</div>
														{:else}
															<span
																class="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500"
															>
																{$_('topo.no_topo')}
															</span>
														{/if}
													</td>
													<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
														{#if getSectorTypes(sector).length > 0 || getSectorDirection(sector)}
															<div class="flex flex-wrap items-center gap-2">
																{#each getSectorTypes(sector) as type}
																	<span
																		class="rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase {getTypeColorClass(
																			type.id
																		)}"
																	>
																		{type.name}
																	</span>
																{/each}
																{#if getSectorDirection(sector)}
																	<span
																		class="flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase"
																	>
																		<i class="fa-solid fa-compass text-slate-400"></i>
																		{getSectorDirection(sector)}
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
						<RouteList
							routes={data.topo.routes}
							topo={data.topo}
							{fallbackAccessTracks}
							{activeRouteId}
							{pendingRouteId}
							onRouteHover={(route: Route | null) => (hoveredRouteId = route?.id ?? null)}
							onRouteSelect={(route: Route) => {
								hoveredRouteId = null;
								goto(base + '/topo/crag/' + data.path + '/' + route.id + $page.url.search);
								if (infoPanelComponent) infoPanelComponent.moveToLowest();
							}}
						/>
					</div>
				</div>
			{/if}
		</div>
	</InfoPanel>
</main>

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
		.topo-container-fade {
			-webkit-mask-image: linear-gradient(to right, black 98%, transparent 100%);
			mask-image: linear-gradient(to right, black 98%, transparent 100%);
		}
	}
</style>
