<script lang="ts">
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import { Canvas, T, useTask, useThrelte } from '@threlte/core';
	import { interactivity, OrbitControls, useProgress } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import { Box3, Sphere, TOUCH, Vector3, WebGLRenderer } from 'three';
	import { cubicOut } from 'svelte/easing';
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
		calculateBestSeason,
		calculateSunInfo,
		calculateSunPositionVector,
		calculateWallDirection
	} from '$lib/assets/js/sun-calculations';
	import SunChart from '$lib/components/charts/SunChart.svelte';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import { getTypeColorClass } from '$lib/assets/js/route-types.js';
	import RouteSteepnessChart from '$lib/components/charts/RouteSteepnessChart.svelte';
	import SteepnessDistribution from '$lib/components/charts/SteepnessDistribution.svelte';
	import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';
	import RouteList from '$lib/components/topo/RouteList.svelte';
	import FloatingButton from '$lib/components/topo/FloatingButton.svelte';
	import FloatingControlsTop from '$lib/components/topo/FloatingControlsTop.svelte';
	import FloatingControlsBottom from '$lib/components/topo/FloatingControlsBottom.svelte';
	import { colors } from '$lib/colors.js';

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
	let displayModeMenuOpen = $state(false);

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
		data.topo?.routes?.some(
			(r) =>
				r.points2D?.length > 0 ||
				r.pitches?.some((pitch) => pitch.points2D?.length > 0) ||
				r.variants?.some((variant) => variant.points2D?.length > 0)
		) ||
		data.topo?.outlines?.length > 0 ||
		data.topo?.fixPoints?.some((fp) => fp.position2D) ||
		data.topo?.textLabels?.some((label) => label.position2D)
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
			(r) =>
				r.id === childId ||
				(r.pitches && r.pitches.some((p) => p.id === childId)) ||
				(r.variants && r.variants.some((variant) => variant.id === childId))
		);
	}

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
		if (!controls || !camera || !data.topo || !data.topo.routes || data.topo.routes.length === 0) return;

		let points: number[][] = [];
		let orientations: Vector3[] = [];
		
		data.topo.routes.forEach(r => {
			if (r.type?.includes('multi-pitch') && r.pitches) {
				r.pitches.forEach((p: any) => {
					if (p.points) points.push(...p.points);
					if (p.orientation) orientations.push(new Vector3(p.orientation[0], p.orientation[1], p.orientation[2]));
				});
			} else if (r.points) {
				points.push(...r.points);
				if (r.orientation) orientations.push(new Vector3(r.orientation[0], r.orientation[1], r.orientation[2]));
			}
		});

		if (points.length === 0) return;

		const box = new Box3();
		points.forEach(p => box.expandByPoint(new Vector3(p[0], p[1], p[2])));
		const center = new Vector3();
		box.getCenter(center);
		
		const sphere = new Sphere();
		box.getBoundingSphere(sphere);

		let avgOrientation = new Vector3(0, 0, 1);
		if (orientations.length > 0) {
			avgOrientation.set(0, 0, 0);
			orientations.forEach(o => avgOrientation.add(o));
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

	let lastFocusedRouteId = $state(null);
	let hoveredRouteId = $state(null);
	let isProgrammaticAnimationRunning = $state(false);

	$effect(() => {
		if (activeRouteId && modelLoaded && !isCameraMoving && activeRouteId !== lastFocusedRouteId) {
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
							routeToFocus = { ...pitch, orientation: pitch.orientation || r.orientation };
							break;
						}
					}
				}
			}

			if (routeToFocus) focusRoute(routeToFocus);
		} else if (!activeRouteId && lastFocusedRouteId) {
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
			? $navigating.to.url.pathname.split('/').pop()
			: null
	);

	let isNavigatingAway = $derived(
		!!($navigating && $navigating.to && !$navigating.to.url.pathname.startsWith(base + '/topo/crag/'))
	);

	let activeRouteId = $derived(pendingRouteId || data.route?.id);


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

	let visualRoutes = $state<any[]>([]);
	let lastTopoPath = '';

	$effect(() => {
		const currentPath = data?.path;
		const topoRoutes = data?.topo?.routes;

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
			if (!activeRouteId) {
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
				if (activeRouteId) {
					const r = data.topo.routes?.find((route: any) => route.id === activeRouteId);
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
						isProgrammaticAnimationRunning = false;
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
		if (!grade) return colors.topo.gradeUnknown;
		const g = grade.toLowerCase();
		if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) return colors.topo.gradeEasy;
		if (g.startsWith('6')) return colors.topo.gradeMedium;
		if (g.startsWith('7')) return colors.topo.gradeHard;
		if (g.startsWith('8') || g.startsWith('9')) return colors.topo.gradeVeryHard;
		return colors.topo.gradeUnknown;
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
			{ count: easy, percent: (easy / total) * 100, colorClass: 'bg-green-500', label: '< 6a' },
			{ count: medium, percent: (medium / total) * 100, colorClass: 'bg-yellow-400', label: '6a - 6c+' },
			{ count: hard, percent: (hard / total) * 100, colorClass: 'bg-red-500', label: '7a - 7c+' },
			{ count: veryHard, percent: (veryHard / total) * 100, colorClass: 'bg-purple-600', label: '> 8a' }
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


</script>

<svelte:window onroute-clicked={handleRouteClicked} />

<div class="topo-container h-screen w-screen md:w-3/4 absolute overflow-hidden pointer-events-auto">
	{#if displayMode === '2d' && has2D}
		<Topo2DViewer
			topo={data.topo}
			routes={data.topo.routes || []}
			selectedRouteId={getParentRoute(activeRouteId)?.id || activeRouteId}
			onRouteSelect={(route) => goto(base + '/topo/crag/' + data.path + '/' + route.id + $page.url.search)}
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
						link={base + '/topo/crag/' + data.path + '/' + (route.parentId || route.id) + $page.url.search}
						points={route.points}
						name={route.name}
						grade={route.grade}
						id={route.id}
						color={activeRouteId && (activeRouteId === route.id || activeRouteId === route.parentId)
							? colors.topo.routeHover
							: getGradeColor(route.grade)}
						width={activeRouteId && (activeRouteId === route.id || activeRouteId === route.parentId) ? 0.1 : 0.08}
						isSelected={!!activeRouteId && (activeRouteId === route.id || activeRouteId === route.parentId)}
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
	{#snippet hdButton()}
		{#if displayMode === '3d' && data.lowResModelUrl}
			{#if progress < 1 && (forceHighRes || (!isSlowNetwork && modelLoaded))}
				<div class="pointer-events-auto flex items-center justify-center relative w-10 h-10 max-sm:w-11 max-sm:h-11 rounded-2xl border-1 border-gray-200 bg-white shadow-md">
					<div class="absolute w-6 h-6 max-sm:w-7 max-sm:h-7 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
					<span class="text-[10px] max-sm:text-[12px] font-bold text-blue-600 z-10">HD</span>
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
			<div class="flex flex-row max-sm:flex-row-reverse items-center justify-start max-sm:w-full gap-2">
				<FloatingButton
					icon="fa-sun"
					title="Daylight Simulator"
					active={isDaylightSimulation}
					activeClasses="bg-yellow-100 text-yellow-600 border-yellow-300"
					onclick={() => (isDaylightSimulation = !isDaylightSimulation)}
				/>
				{#if isDaylightSimulation}
					<div transition:slide={{ axis: 'x', duration: 300 }} class="bg-white/90 backdrop-blur max-sm:p-3 sm:px-2 sm:py-1 rounded-2xl max-sm:shadow-lg sm:shadow-sm border-1 border-gray-200 flex flex-row items-center pointer-events-auto sm:h-10 flex-1 min-w-[200px]">
						<input type="date" value={simulationDate} oninput={(e) => (simulationDate = e.currentTarget.value)} class="text-xs font-bold text-gray-500 bg-transparent border-none outline-none w-24 cursor-pointer font-mono text-center shrink-0" />
						<div class="w-px h-6 bg-gray-300 mx-2 shrink-0"></div>
						<div class="flex items-center gap-2 flex-1 min-w-0">
							<span class="text-xs font-bold text-gray-500 w-10 text-right font-mono shrink-0">
								{Math.floor(simulationTime)}:{Math.floor((simulationTime % 1) * 60).toString().padStart(2, '0')}
							</span>
							<input type="range" min="0" max="24" step="0.25" value={simulationTime} oninput={(e) => (simulationTime = parseFloat(e.currentTarget.value))} class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500 min-w-0" />
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}

	<div class="pointer-events-none fixed left-0 right-0 top-2 z-[1000] h-fit overflow-visible py-2 sm:top-3 sm:w-auto">
		<div class="pointer-events-auto mx-4 sm:mx-0 sm:ml-8 sm:w-[30vw] sm:max-w-64 md:max-w-72 lg:max-w-80">
			<div class="flex items-center h-[50px] sm:h-[40px] pointer-events-auto">
				<FloatingButton class="w-auto px-4 gap-2 font-bold text-sm" icon="fa-arrow-left" title={$_('ui.to_map')} href="{base}/map/crag/{data.path}">
					<span>{$_('ui.to_map')}</span>
				</FloatingButton>
			</div>
		</div>
	</div>

	<FloatingControlsTop>
		{#if has2D && has3D}
			<div class="flex flex-col items-end sm:items-start pointer-events-auto gap-2" role="group" aria-label="Topo display mode" onmouseleave={() => (displayModeMenuOpen = false)}>
				<FloatingButton
					icon="fa-map"
					title="Choose topo display mode"
					onmouseenter={() => (displayModeMenuOpen = true)}
					onfocus={() => (displayModeMenuOpen = true)}
					onclick={() => (displayModeMenuOpen = !displayModeMenuOpen)}
				/>
				{#if displayModeMenuOpen}
					<div class="flex flex-col justify-center gap-2 z-0" transition:slide={{ duration: 200, axis: 'y' }}>
						<button class="cursor-pointer w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 rounded-2xl shadow-md text-gray-600 font-bold text-[12px] max-sm:text-[14px] {displayMode === '3d' ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}" onclick={() => { 
							displayModeMenuOpen = false; 
							const url = new URL($page.url.href); 
							url.searchParams.set('mode', '3d'); 
							goto(url.pathname + url.search, { replaceState: true, keepFocus: true }); 
						}}>
							3D
						</button>
						<button class="cursor-pointer w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 rounded-2xl shadow-md text-gray-600 font-bold text-[12px] max-sm:text-[14px] {displayMode === '2d' ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}" onclick={() => { 
							displayModeMenuOpen = false; 
							const url = new URL($page.url.href); 
							url.searchParams.set('mode', '2d'); 
							goto(url.pathname + url.search, { replaceState: true, keepFocus: true }); 
						}}>
							2D
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div class="hidden sm:flex flex-col items-start gap-2 pointer-events-auto">
			{#if displayMode === '2d' && !isTopoLegendOpen}
				<FloatingButton icon="fa-map-signs" title="Topo legend" onclick={() => (isTopoLegendOpen = true)} />
			{/if}
			{@render hdButton()}
			{@render sunButton()}
		</div>
		<div class="hidden sm:flex pointer-events-auto">
			<TopoLegend
				open={isTopoLegendOpen}
				usedTypes={usedTopoSymbolTypes}
				onClose={() => (isTopoLegendOpen = false)}
			/>
		</div>
	</FloatingControlsTop>

	<FloatingControlsBottom>
		<div class="sm:hidden flex flex-col items-end gap-2 w-full transition-opacity duration-300 {isNavigatingAway ? 'opacity-0' : 'opacity-100'}">
			{#if displayMode === '2d' && !isTopoLegendOpen}
				<FloatingButton icon="fa-map-signs" title="Topo legend" onclick={() => (isTopoLegendOpen = true)} />
			{/if}
			{@render hdButton()}
			{@render sunButton()}
		</div>
		<div class="sm:hidden w-full flex justify-end pointer-events-auto">
			<TopoLegend
				open={isTopoLegendOpen}
				usedTypes={usedTopoSymbolTypes}
				onClose={() => (isTopoLegendOpen = false)}
			/>
		</div>
	</FloatingControlsBottom>

	<InfoPanel onShare={share} isOpen={isInfoPanelOpen && !isNavigatingAway} onClose={() => (isInfoPanelOpen = false)}>
		<div class="flex flex-col h-full flex-1 min-h-0 w-full">
			{#if $navigating && $navigating.to?.url.pathname.startsWith(base + '/topo/crag/')}
			<div class="flex-1 overflow-y-auto w-full px-5 mb-4 mt-6 overflow-x-hidden min-h-0">
				<div class="animate-pulse flex flex-col space-y-4 pt-4">
					<div class="h-8 bg-gray-200 rounded-lg w-1/2 mb-4"></div>
					<div class="flex gap-2 mb-4">
						<div class="h-8 bg-gray-200 rounded-lg w-24"></div>
						<div class="h-8 bg-gray-200 rounded-lg w-24"></div>
						<div class="h-8 bg-gray-200 rounded-lg w-20"></div>
					</div>
					<div class="h-4 bg-gray-200 rounded w-5/6"></div>
					<div class="h-4 bg-gray-200 rounded w-3/4"></div>
					<div class="h-4 bg-gray-200 rounded w-1/2"></div>
					<div class="h-40 mt-6 bg-gray-200 rounded-2xl w-full"></div>
				</div>
			</div>
		{:else if data.route}
			<div
				class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5"
			>
				<a
					href="{base}/topo/crag/{data.path}{$page.url.search}"
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
				<div class="mt-6 w-full min-h-[400px]">
					{#if !isProgrammaticAnimationRunning && renderChartsStage >= 1}
						<div in:slide={{ duration: 200 }}>
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">
								{$_('topo.steepness_distribution')}
							</h3>
							<div class="mb-8">
								<SteepnessDistribution metrics={routeMetrics} />
							</div>
						</div>
					{/if}
					{#if !isProgrammaticAnimationRunning && renderChartsStage >= 2}
						<div in:slide={{ duration: 200 }}>
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.steepness')}</h3>
							<div class="h-48 w-full mb-8">
								<RouteSteepnessChart route={data.route} on:metrics={handleMetrics} />
							</div>
						</div>
					{/if}
					{#if !isProgrammaticAnimationRunning && renderChartsStage >= 3 && sunInfo.chartData}
						<div in:slide={{ duration: 200 }}>
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">{$_('topo.sun_course')}</h3>
							<div class="h-32 w-full">
								<SunChart data={sunInfo.chartData} />
							</div>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div
				class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5"
			>
				<div class="min-w-0">
					<h1
						class="truncate text-2xl font-bold my-0 text-slate-800 sm:px-2">{data.sectorId ? `${data.cragName} - ${currentSectorName}` : data.cragName}</h1>
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
							{#if data.gradeRoutes?.length >= 8}
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
											onclick={() => goto(`${base}/topo/crag/${data.baseCragPath || data.path}/${sector.id}` + $page.url.search)}
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
																<div class="h-full {bucket.colorClass}" style="width: {bucket.percent}%"
																     title="{bucket.label}: {bucket.count}"></div>
															{/each}
														</div>
													</div>
												{:else}
														<span
															class="px-2 py-1 rounded-md bg-slate-50 text-slate-500 font-bold text-xs border border-slate-200">
															{$_('topo.no_topo')}
														</span>
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{#if getSectorTypes(sector).length > 0 || getSectorDirection(sector)}
													<div class="flex items-center gap-2 flex-wrap">
														{#each getSectorTypes(sector) as type}
																<span
																	class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border {getTypeColorClass(type.id)}">
																	{type.name}
																</span>
														{/each}
														{#if getSectorDirection(sector)}
																<span
																	class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
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
					<RouteList
						routes={data.topo.routes}
						activeRouteId={activeRouteId}
						pendingRouteId={pendingRouteId}
						onRouteHover={(route) => (hoveredRouteId = route?.id || null)}
						onRouteSelect={(route) => {
							hoveredRouteId = null;
							goto(base + '/topo/crag/' + data.path + '/' + route.id + $page.url.search);
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
        .topo-container {
            -webkit-mask-image: linear-gradient(to right, black 98%, transparent 100%);
            mask-image: linear-gradient(to right, black 98%, transparent 100%);
        }
    }
</style>
