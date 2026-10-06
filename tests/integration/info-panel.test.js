import { cleanup, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import InfoPanel from '$lib/components/ui/InfoPanel.svelte';

const paneModule = vi.hoisted(() => {
	let resolve;
	const ready = new Promise((done) => (resolve = done));
	const present = vi.fn(() => Promise.resolve());
	const destroy = vi.fn();
	const Constructor = vi.fn(function () {
		return { present, destroy, isHidden: () => false, moveToBreak: vi.fn() };
	});
	return { ready, resolve, Constructor, present, destroy };
});

vi.mock('cupertino-pane', async () => {
	await paneModule.ready;
	return { CupertinoPane: paneModule.Constructor };
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

it('initializes an open mobile panel when the delayed pane import resolves', async () => {
	vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
	const { unmount } = render(InfoPanel, {
		props: {
			onShare: vi.fn(),
			children: createRawSnippet(() => ({ render: () => '<p>Panel content</p>' }))
		}
	});

	expect(paneModule.Constructor).not.toHaveBeenCalled();
	paneModule.resolve();
	await waitFor(() => expect(paneModule.Constructor).toHaveBeenCalledTimes(1));
	expect(paneModule.present).toHaveBeenCalledWith({ animate: true });
	unmount();
	expect(paneModule.destroy).toHaveBeenCalled();
});
