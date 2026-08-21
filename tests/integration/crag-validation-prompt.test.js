import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CragValidationPrompt from '$lib/components/CragValidationPrompt.svelte';

const issue = {
	rule: 'access',
	copyKey: 'validation.rules.access',
	task: 'access',
	target: { cragPath: 'area/crag', sectorId: null }
};

describe('CragValidationPrompt', () => {
	afterEach(() => {
		cleanup();
		localStorage.clear();
	});

	it('renders one translated prompt and a prefilled external editor link', () => {
		render(CragValidationPrompt, {
			props: {
				issue,
				editorUrl: 'https://studio.example/edit',
				returnTo: 'https://site.example/map/crag/area/crag'
			}
		});
		expect(screen.getByText('validation.title')).toBeInTheDocument();
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('href', expect.stringContaining('task=access'));
	});

	it('allows local dismissal for thirty days and hides the CTA when no editor is configured', async () => {
		const { rerender } = render(CragValidationPrompt, {
			props: { issue, editorUrl: '', returnTo: '' }
		});
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button'));
		expect(screen.queryByText('validation.title')).not.toBeInTheDocument();
		render(CragValidationPrompt, {
			props: { issue, editorUrl: 'https://studio.example/edit', returnTo: '' }
		});
		expect(screen.queryByText('validation.title')).not.toBeInTheDocument();
		await rerender({ issue: null, editorUrl: '', returnTo: '' });
	});
});
