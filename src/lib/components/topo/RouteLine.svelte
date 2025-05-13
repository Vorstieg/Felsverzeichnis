<script>
	import { T } from '@threlte/core';
	import { interactivity, useCursor } from '@threlte/extras';
	import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
	import CssObject from './CssObject.svelte';
	import { goto } from '$app/navigation';

	const { hovering, onPointerEnter, onPointerLeave } = useCursor();

	interactivity();

	let {
		points = [],
		color = '#ffdf12',
		width = 0.02,
		name = '',
		grade = '',
		id = 'unknown',
		link = '',
		isSelected = false
	} = $props();

	const hoverColor = '#ff0000';
	const hoverWidth = 0.25;
	let currentColor = $derived($hovering ? hoverColor : color);
	let currentWidth = $derived($hovering ? hoverWidth : width);

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

	const labelClass = 'route-label';

</script>

{#if vectorPoints.length >= 2}
	<T.Mesh
		onpointerenter={onPointerEnter}
		onpointerleave={onPointerLeave}
		onclick={() => {
				goto(link);
  }}>
		<T is={TubeGeometry} args={[
				pathCurve,
				vectorPoints.length * 3,
				currentWidth * 0.5,
				5,
				false
			]} />
		<T.MeshBasicMaterial color={currentColor} />
	</T.Mesh>

	{#if name && ($hovering || isSelected)}
		<CssObject position={labelPosition}>
			<div class={labelClass}
					 onpointerenter={onPointerEnter}
					 onpointerleave={onPointerLeave}
					 onclick={() => {
						goto(link);
  }}>
				{name} - {grade}
			</div>
		</CssObject>
	{/if}
{/if}