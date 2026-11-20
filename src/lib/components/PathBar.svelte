<script lang="ts">
	import type { Gallery } from '#lib/gallery.svelte.ts';
	import Icon from './Icon.svelte';

	let {
		g,
		onnewfolder,
		onrename,
		onmove,
		ondelete
	}: {
		g: Gallery;
		onnewfolder: () => void;
		onrename: () => void;
		onmove: () => void;
		ondelete: () => void;
	} = $props();

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	const status = $derived.by(() => {
		if (g.searching) {
			const parts = [plural(g.visible.length, 'image')];
			if (g.visibleFolders.length) parts.unshift(plural(g.visibleFolders.length, 'folder'));
			return `Found ${parts.join(', ')}${g.current ? ' in this folder' : ''}`;
		}
		const parts = [];
		if (g.visibleFolders.length) parts.push(plural(g.visibleFolders.length, 'folder'));
		if (g.levelCount || !parts.length) parts.push(plural(g.levelCount, 'image'));
		return parts.join(', ');
	});
</script>

<nav class="pathbar" aria-label="Folders">
	<ol class="crumbs">
		<li>
			<a href="/" class="crumb" aria-current={g.folderId === null ? 'page' : undefined}>
				<Icon name="home" size={17} />
				<span>Gallery</span>
			</a>
		</li>
		{#each g.trail as folder, i (folder.id)}
			<li>
				<span class="sep" aria-hidden="true">/</span>
				<a
					href={g.url(folder.id)}
					class="crumb"
					aria-current={i === g.trail.length - 1 ? 'page' : undefined}
				>
					{folder.name}
				</a>
			</li>
		{/each}
		{#if g.user && g.current}
			<li class="folder-actions">
				<button class="icon-btn small" title="Rename folder" aria-label="Rename folder" onclick={onrename}>
					<Icon name="edit" size={17} />
				</button>
				<button class="icon-btn small" title="Move folder" aria-label="Move folder" onclick={onmove}>
					<Icon name="move" size={17} />
				</button>
				<button class="icon-btn small" title="Delete folder" aria-label="Delete folder" onclick={ondelete}>
					<Icon name="trash" size={17} />
				</button>
			</li>
		{/if}
	</ol>

	<div class="right">
		<span class="status">{status}</span>
		{#if g.user}
			<button class="icon-btn" title="New folder" aria-label="New folder" onclick={onnewfolder}>
				<Icon name="folderPlus" />
			</button>
			<button
				class="icon-btn"
				class:active={g.selecting}
				title="Select images"
				aria-label="Select images"
				aria-pressed={g.selecting}
				onclick={() => (g.selecting ? g.stopSelecting() : (g.selecting = true))}
			>
				<Icon name="select" />
			</button>
		{/if}
	</div>
</nav>

<style>
	.pathbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		margin: 0 0 12px;
		min-height: 40px;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.crumbs li {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.crumb {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 40vw;
		padding: 6px 8px;
		overflow: hidden;
		border-radius: 8px;
		color: var(--muted);
		text-decoration: none;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.crumb span {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.crumb:hover {
		background: var(--panel);
		color: var(--text);
	}

	.crumb[aria-current='page'] {
		color: var(--text);
		font-weight: 600;
	}

	.sep {
		color: var(--line);
		font-size: 1.1rem;
	}

	.folder-actions {
		gap: 2px;
		margin-left: 4px;
	}

	.small {
		width: 32px;
		height: 32px;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
	}

	.status {
		margin-right: 6px;
		font-size: 0.85rem;
		color: var(--muted);
		white-space: nowrap;
	}
</style>
