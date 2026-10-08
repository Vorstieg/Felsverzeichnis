<script lang="ts">
	import { T, useThrelte, useTask } from '@threlte/core';
	import { useCursor } from '@threlte/extras';
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
		grade = null,
		link = '',
		isSelected = false,
		isCameraMoving = false,
		isHoveredExternally = false
	}: {
		points?: import('@vorstieg/fels-types/types').Point3D[];
		color?: string;
		width?: number;
		name?: string;
		grade?: import('@vorstieg/fels-types/types').Grade;
		link?: string;
		isSelected?: boolean;
		isCameraMoving?: boolean;
		isHoveredExternally?: boolean;
	} = $props();

	let isClose = $state(false);
	let isVisible = $state(false);
	const CLOSE_DISTANCE = 15;
	const VISIBLE_DISTANCE = 40;

	const hoverWidth = 0.2;

	let isHovered = $derived(($hovering || isHoveredExternally) && !isCameraMoving);

	let currentWidth = $derived(isHovered || isSelected ? hoverWidth : width);

	let pathCurve = $derived.by(() => {
		if (vectorPoints.length >= 2) {
			return new CatmullRomCurve3(vectorPoints, false, 'catmullrom', 0);
		}
		return null;
	});

	let vectorPoints = $derived(points.map((p) => new Vector3(p[0], p[1], p[2])));

	let labelPosition: import('@vorstieg/fels-types/types').Point3D = $derived.by(() => {
		if (points.length < 1) return [0, 0, 0];
		return points[Math.floor(points.length / 2)];
	});

	useTask(() => {
		if (!camera.current) return;
		const pos = new Vector3(...labelPosition);
		const dist = camera.current.position.distanceTo(pos);
		isClose = dist < CLOSE_DISTANCE;
		isVisible = dist < VISIBLE_DISTANCE;
	});

	const labelClass = 'route-label';

	function openRoute(event?: { stopPropagation: () => void }) {
		event?.stopPropagation();
		goto(link);
		if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('route-clicked'));
	}
</script>

{#if vectorPoints.length >= 2}
	<!-- Visual Pipe -->
	{#if pathCurve}
		{#if isHovered || isSelected}
			<T.Mesh>
				<T is={TubeGeometry} args={[pathCurve, vectorPoints.length * 10, currentWidth, 4, false]} />
				<T.MeshBasicMaterial color="white" transparent opacity={0.3} depthWrite={false} />
			</T.Mesh>
		{/if}

		<T.Mesh>
			<T
				is={TubeGeometry}
				args={[pathCurve, vectorPoints.length * 10, currentWidth / 2, 4, false]}
			/>
			<T.MeshBasicMaterial {color} />
		</T.Mesh>
	{/if}

	<!-- Hit Box -->
	<T.Mesh onpointerenter={onPointerEnter} onpointerleave={onPointerLeave} onclick={openRoute}>
		{#if pathCurve}
			<T is={TubeGeometry} args={[pathCurve, vectorPoints.length, 0.15, 4, false]} />
			<T.MeshBasicMaterial transparent opacity={0} depthWrite={false} />
		{/if}
	</T.Mesh>

	{#if (name || grade) && (isVisible || isHovered || isSelected)}
		<CssObject position={labelPosition} pointerEvents={true}>
			<div
				class={labelClass}
				role="link"
				tabindex="0"
				aria-label={`Open ${name || grade?.value}`}
				style:border-left="5px solid {color}"
				onpointerenter={onPointerEnter}
				onpointerleave={onPointerLeave}
				onclick={openRoute}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						openRoute(event);
					}
				}}
			>
				{#if isHovered || isSelected || isClose}
					{name} - {grade?.value}
				{:else}
					{grade?.value}
				{/if}
			</div>
		</CssObject>
	{/if}
{/if}
