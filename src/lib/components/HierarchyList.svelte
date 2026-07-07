<script>
	import HierarchyNode from './HierarchyNode.svelte';

	let { crags = [] } = $props();

	let tree = $derived.by(() => {
		const root = { name: 'Root', path: '', children: {}, crag: null };
		
		for (const crag of crags) {
			const pathStr = crag.properties.path || '';
			// paths are usually like "Country/Region/Area/Crag"
			const parts = pathStr.split('/').filter(Boolean);
			
			let current = root;
			let currentPath = '';
			
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				currentPath = currentPath ? `${currentPath}/${part}` : part;
				
				if (!current.children[part]) {
					current.children[part] = {
						name: part,
						path: currentPath,
						children: {},
						crag: null
					};
				}
				current = current.children[part];
			}
			// The final node is the crag itself
			current.crag = crag;
			// Replace the name from the path part to the actual crag name for the leaf node
			if (crag.properties.name) {
				current.name = crag.properties.name;
			}
		}
		
		return root;
	});
</script>

<div class="mb-2">
	{#each Object.values(tree.children).sort((a, b) => a.name.localeCompare(b.name)) as child}
		<HierarchyNode node={child} depth={0} />
	{/each}
</div>
