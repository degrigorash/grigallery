<script lang="ts" module>
	export interface PickRequest {
		title: string;
		/** Where the things being moved are now; shown but not selectable. */
		from?: string | null;
		/** A folder being moved can't go into itself or anything inside it. */
		exclude?: string;
		pick: (folderId: string | null) => Promise<void>;
	}
</script>

<script lang="ts">
	import type { Gallery } from '#lib/gallery.svelte.ts';
	import Icon from './Icon.svelte';

	let { g, request = $bindable(null) }: { g: Gallery; request?: PickRequest | null } = $props();

	let dialog: HTMLDialogElement;
	let busy = $state(false);
	let errorText = $state('');

	const blocked = $derived(request?.exclude ? g.descendants(request.exclude) : new Set<string>());

	$effect(() => {
		if (request && !dialog.open) {
			errorText = '';
			dialog.showModal();
		} else if (!request && dialog.open) {
			dialog.close();
		}
	});

	async function choose(id: string | null) {
		if (!request) return;
		busy = true;
		errorText = '';
		try {
			await request.pick(id);
			request = null;
		} catch (err) {
			errorText = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<dialog class="dialog picker" bind:this={dialog} onclose={() => (request = null)}>
	<div class="head">
		<h2>{request?.title}</h2>
		<button class="icon-btn" aria-label="Close" onclick={() => (request = null)}>
			<Icon name="close" />
		</button>
	</div>
	<ul class="tree">
		{#each g.options as opt (opt.id)}
			{@const here = opt.id === request?.from}
			{@const off = opt.id !== null && blocked.has(opt.id)}
			<li>
				<button
					class="row"
					class:here
					style:padding-left="{12 + opt.depth * 18}px"
					disabled={busy || here || off}
					onclick={() => choose(opt.id)}
				>
					<Icon name={opt.id === null ? 'home' : 'folder'} size={18} />
					<span class="label">{opt.label}</span>
					{#if here}<span class="note">here now</span>{/if}
				</button>
			</li>
		{/each}
	</ul>
	<p class="error" role="alert">{errorText}</p>
</dialog>

<style>
	.picker {
		width: min(480px, calc(100vw - 24px)) !important;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.tree {
		max-height: 60vh;
		margin: 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 42px;
		padding-right: 12px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		text-align: left;
	}

	.row:hover:not(:disabled) {
		background: var(--panel-2);
	}

	.row:disabled {
		opacity: 0.45;
	}

	.row.here {
		opacity: 0.7;
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.note {
		font-size: 0.78rem;
		color: var(--muted);
	}

	.error {
		min-height: 1.2em;
		margin: 8px 0 0;
		font-size: 0.9rem;
		color: var(--danger);
	}
</style>
