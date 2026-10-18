import { Topo } from './topo-paths.js';
import { createCragCache } from './crag-cache';
import { getRouteTracks } from './route-gpx.js';
import { has2DTopo } from './crag-validation.js';
import type { FelsLocation } from '$lib/types/files';
import type { RouteSummary } from '$lib/types/application';

export function createEntryLoader(options: Parameters<typeof createCragCache>[0]) {
	const cache = createCragCache(options);
	const parentPath = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));
	const paths = (path: string) => new Topo(parentPath(path), path.split('/').at(-1) ?? '');

	async function resolve(path: string, locations: FelsLocation[] = [], allowRoute = false) {
		const read = async (folder: string): Promise<FelsLocation | null> => {
			const entry = await cache.fetchEntry(paths(folder).getCurrentPath());
			return entry
				? { path: folder, entry }
				: (locations.find((location) => location.path === folder) ?? null);
		};
		let location = await read(path);
		let folder = path;
		while (!location && allowRoute && folder.includes('/')) {
			folder = parentPath(folder);
			location = await read(folder);
		}
		if (!location) return null;
		const ancestorFolders: string[] = [];
		folder = parentPath(location.path);
		while (folder) {
			ancestorFolders.push(folder);
			folder = parentPath(folder);
		}
		const [resolvedAncestors, rawDirectory] = await Promise.all([
			Promise.all(ancestorFolders.map((ancestorFolder) => read(ancestorFolder))),
			cache.fetchDirectory(location.path)
		]);
		const ancestors = resolvedAncestors.filter(
			(ancestor): ancestor is FelsLocation => ancestor !== null
		);
		const directory = rawDirectory ?? [];
		const children = locations.filter((item) => parentPath(item.path) === location.path);
		const missingChildPaths = directory
			.filter((file) => file.type === 'dir')
			.map((file) => `${location.path}/${file.name}`)
			.filter((childPath) => !children.some((child) => child.path === childPath));
		if (missingChildPaths.length > 0) {
			const resolvedChildren = await Promise.all(
				missingChildPaths.map((childPath) => read(childPath))
			);
			for (const child of resolvedChildren) {
				if (child) children.push(child);
			}
		}
		return {
			location,
			ancestors,
			children,
			directory,
			paths: paths(location.path),
			routeId: path === location.path ? null : path.slice(location.path.length + 1)
		};
	}

	async function core(context: NonNullable<Awaited<ReturnType<typeof resolve>>>) {
		const [topo, directAccess] = await Promise.all([
			cache.fetchTopo(context.paths.getTopoPath()),
			cache.fetchAccess(context.paths.getAccessPath())
		]);
		let access = directAccess;
		for (const ancestor of context.ancestors) {
			if (access?.features?.length) break;
			const ancestorAccess = await cache.fetchAccess(paths(ancestor.path).getAccessPath());
			if (ancestorAccess && (!access || ancestorAccess.features?.length)) {
				access = ancestorAccess;
			}
		}
		return { topo, access };
	}

	async function details(
		context: NonNullable<Awaited<ReturnType<typeof resolve>>>,
		loaded?: Awaited<ReturnType<typeof core>>
	) {
		const { location, children, directory } = context;
		const { topo, access } = loaded ?? (await core(context));
		const childTopos = (
			await Promise.all(
				children.map(async (child) => {
					const childPaths = paths(child.path);
					const [document, rawFiles] = await Promise.all([
						cache.fetchTopo(childPaths.getTopoPath()),
						cache.fetchDirectory(child.path)
					]);
					const files = rawFiles ?? [];
					return {
						sectorId: child.entry.properties.id,
						sectorName: child.entry.properties.name,
						topo: document,
						has3DTopo: files.some(
							(file) => file.type === 'file' && file.name === childPaths.getGlbName()
						),
						has2DTopo: has2DTopo(document)
					};
				})
			)
		).filter((child) => child.topo || child.has3DTopo);
		const ownRoutes: RouteSummary[] = (topo?.routes ?? []).map((route) => ({
			...route,
			downloadTracks: getRouteTracks(topo, route)
		}));
		const childRoutes: RouteSummary[] = childTopos.flatMap((child) =>
			(child.topo?.routes ?? []).map((route) => ({
				...route,
				downloadTracks: getRouteTracks(child.topo, route),
				sectorId: child.sectorId,
				sectorName: child.sectorName,
				sectorTags: child.topo?.tags
			}))
		);
		return {
			topoJson: topo,
			access,
			sectorTopos: childTopos,
			gradeRoutes: childRoutes.length ? childRoutes : ownRoutes,
			images: directory
				.filter((file) => file.type === 'file' && /\.(jpg|jpeg|png|gif|pdf)$/i.test(file.name))
				.map((file) => `${options.apiUrl}/${location.path}/${file.name}`),
			has3DTopo: directory.some(
				(file) => file.type === 'file' && file.name === context.paths.getGlbName()
			),
			has2DTopo: has2DTopo(topo)
		};
	}
	async function cacheContext(context: NonNullable<Awaited<ReturnType<typeof resolve>>>) {
		await Promise.all([
			cache.cacheCragFolder(context.location.path),
			cache.cacheFiles(
				context.ancestors.flatMap((ancestor) => {
					const ancestorPaths = paths(ancestor.path);
					return [ancestorPaths.getCurrentPath(), ancestorPaths.getAccessPath()];
				})
			)
		]);
	}
	return { resolve, core, details, cacheFolder: cache.cacheCragFolder, cacheContext };
}
