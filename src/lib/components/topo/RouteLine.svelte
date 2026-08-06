<script>
	import { T, useThrelte, useTask } from '@threlte/core';
	import { interactivity, useCursor } from '@threlte/extras';
	import { CatmullRomCurve3, Vector3, TubeGeometry } from 'three';
	import CssObject from './CssObject.svelte';
	import { goto } from '$app/navigation';
	import { colors } from '$lib/colors.js';

	const { hovering, onPointerEnter, onPointerLeave } = useCursor();
	const { camera } = useThrelte();

	let {
		points = [],
		color = colors.topo.route,
		width = 0.07,
		name = '',
		grade = '',
		id = 'unknown',
		link = '',
		isSelected = false,
		isCameraMoving = false,
		isHoveredExternally = false
	} = $props();

	let isClose = $state(false);
	let isVisible = $state(false);
	const CLOSE_DISTANCE = 15;
	const VISIBLE_DISTANCE = 40;

	const hoverColor = colors.topo.routeHover;
	const hoverWidth = 0.2;
	
	let isHovered = $derived(($hovering || isHoveredExternally) && !isCameraMoving);
	
	let currentColor = $derived(isHovered ? hoverColor : color);
	let currentWidth = $derived((isHovered || isSelected) ? hoverWidth : width);

	let pathCurve = $derived.by(() => {
		if (vectorPoints.length >= 2) {
			return new CatmullRomCurve3(vectorPoints, false, 'catmullrom', 0);
		}
		return null;
	});

	let vectorPoints = $derived(points.map(p => new Vector3(p[0], p[1], p[2])));

	let labelPosition = $derived.by(() => {
		if (points.length < 1) return [0, 0, 0];
		return points[Math.floor((points.length / 2))];
	});

	useTask(() => {
		if (!camera.current) return;
		const pos = new Vector3(...labelPosition);
		const dist = camera.current.position.distanceTo(pos);
		isClose = dist < CLOSE_DISTANCE;
		isVisible = dist < VISIBLE_DISTANCE;
	});

	const labelClass = 'route-label';

</script>

{#if vectorPoints.length >= 2}
	<!-- Visual Pipe -->
	{#if pathCurve}
		{#if isHovered || isSelected}
			<T.Mesh>
				<T is={TubeGeometry} args={[
						pathCurve,
						vectorPoints.length * 10,
						currentWidth, 
						4,
						false
					]} />
				<T.MeshBasicMaterial
					color="white"
					transparent
					opacity={0.3}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}

		<T.Mesh>
			<T is={TubeGeometry} args={[
					pathCurve,
					vectorPoints.length * 10,
					currentWidth / 2,
					4,
					false
				]} />
			<T.MeshBasicMaterial
				color={color}
			/>
		</T.Mesh>
	{/if}

	<!-- Hit Box -->
	<T.Mesh
		onpointerenter={onPointerEnter}
		onpointerleave={onPointerLeave}
		onclick={(e) => {
				e?.stopPropagation();
				goto(link);
				if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('route-clicked'));
  }}>
		{#if pathCurve}
			<T is={TubeGeometry} args={[
					pathCurve,
					vectorPoints.length,
					0.15,
					4,
					false
				]} />
			<T.MeshBasicMaterial transparent opacity={0} depthWrite={false} />
		{/if}
	</T.Mesh>

	{#if (name || grade) && (isVisible || isHovered || isSelected)}
		<CssObject position={labelPosition} pointerEvents={true}>
			<div class={labelClass}
					 style:border-left="5px solid {color}"
					 onpointerenter={onPointerEnter}
					 onpointerleave={onPointerLeave}
		onclick={(e) => {
				e?.stopPropagation();
				goto(link);
				if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('route-clicked'));
  }}>
				{#if isHovered || isSelected || isClose}
					{name} - {grade}
				{:else}
					{grade}
				{/if}
			</div>
		</CssObject>
	{/if}
{/if}
