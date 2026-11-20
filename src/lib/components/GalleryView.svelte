<script lang="ts">
	import { formatDate, formatSize, ratio } from '#lib/format.ts';
	import type { Gallery } from '#lib/gallery.svelte.ts';
	import type { GalleryImage } from '#lib/types.ts';
	import Icon from './Icon.svelte';

	let { g, onopen }: { g: Gallery; onopen: (id: string) => void } = $props();

	function open(e: MouseEvent, id: string) {
		// Let ctrl/cmd/middle click open the link in a new tab as usual.
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		if (g.selecting) g.toggleSelected(id);
		else onopen(id);
	}

	const countLabel = (id: string) => {
		const n = g.counts.get(id) ?? 0;
		return `${n} ${n === 1 ? 'image' : 'images'}`;
	};

	// Justified rows: fill each row edge to edge with every picture at the same
	// height, never taller than the target. Needs the container width, so until
	// the page runs in the browser a CSS approximation is shown instead.
	const ROW_GAP = 6;
	let rowsWidth = $state(0);
	const target = $derived(rowsWidth < 640 ? 120 : 240);

	const rows = $derived.by(() => {
		const width = rowsWidth - 1;
		if (width <= 0) return [];
		const out: { height: number; items: { item: GalleryImage; width: number }[] }[] = [];
		let row: { item: GalleryImage; ar: number }[] = [];
		let sum = 0;
		const flush = (height: number) => {
			out.push({ height, items: row.map((r) => ({ item: r.item, width: r.ar * height })) });
			row = [];
			sum = 0;
		};
		for (const item of g.visible) {
			const ar = ratio(item.width, item.height);
			row.push({ item, ar });
			sum += ar;
			const height = (width - ROW_GAP * (row.length - 1)) / sum;
			if (height <= target) flush(height);
		}
		if (row.length) flush(Math.min(target, (width - ROW_GAP * (row.length - 1)) / sum));
		return out;
	});
</script>

{#snippet rowTile(item: GalleryImage, style: string)}
	<a
		class="rtile"
		class:picked={g.selected.has(item.id)}
		href="?img={item.id}"
		{style}
		style:background-color={item.color}
		onclick={(e) => open(e, item.id)}
	>
		<img
			src={item.thumb}
			alt={item.name}
			loading="lazy"
			decoding="async"
			width={item.width}
			height={item.height}
		/>
		<span class="caption">{item.name}</span>
		{@render mark(item.id)}
	</a>
{/snippet}

{#snippet mark(id: string)}
	{#if g.selecting}
		<span class="mark" class:on={g.selected.has(id)} aria-hidden="true">
			<Icon name="check" size={16} />
		</span>
	{/if}
{/snippet}

{#if g.view === 'grid'}
	<div class="grid">
		{#each g.visibleFolders as folder (folder.id)}
			{@const cover = g.covers.get(folder.id)}
			<a class="tile" href={g.url(folder.id)}>
				{#if cover}
					<div class="frame folder-cover" style:background-color={cover.color}>
						<img src={cover.thumb} alt="" loading="lazy" decoding="async" />
						<span class="fbadge"><Icon name="folder" size={16} />{countLabel(folder.id)}</span>
					</div>
				{:else}
					<div class="frame folder-frame">
						<Icon name="folder" size={48} />
						<span class="fcount">{countLabel(folder.id)}</span>
					</div>
				{/if}
				<span class="caption">{folder.name}</span>
			</a>
		{/each}
		{#each g.visible as item (item.id)}
			<a
				class="tile"
				class:picked={g.selected.has(item.id)}
				href="?img={item.id}"
				onclick={(e) => open(e, item.id)}
			>
				<div class="frame" style:background-color={item.color}>
					<img
						src={item.thumb}
						alt={item.name}
						loading="lazy"
						decoding="async"
						width={item.width}
						height={item.height}
					/>
					{@render mark(item.id)}
				</div>
				<span class="caption">{item.name}</span>
			</a>
		{/each}
	</div>
{:else if g.view === 'rows'}
	{#if g.visibleFolders.length}
		<div class="fstrip">
			{#each g.visibleFolders as folder (folder.id)}
				{@const cover = g.covers.get(folder.id)}
				<a class="fcard" href={g.url(folder.id)}>
					{#if cover}
						<span class="fthumb-sm" style:background-color={cover.color}>
							<img src={cover.thumb} alt="" loading="lazy" decoding="async" />
						</span>
					{:else}
						<Icon name="folder" size={22} />
					{/if}
					<span class="fname">{folder.name}</span>
					<span class="fmeta">{g.counts.get(folder.id) ?? 0}</span>
				</a>
			{/each}
		</div>
	{/if}
	<div class="rows" bind:clientWidth={rowsWidth}>
		{#if rows.length}
			{#each rows as row, i (i)}
				<div class="row" style:gap="{ROW_GAP}px">
					{#each row.items as { item, width } (item.id)}
						{@render rowTile(item, `width:${width}px;height:${row.height}px`)}
					{/each}
				</div>
			{/each}
		{:else}
			<div class="rows-fallback">
				{#each g.visible as item (item.id)}
					{@render rowTile(item, `--ar:${ratio(item.width, item.height)}`)}
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="list">
		{#each g.visibleFolders as folder (folder.id)}
			{@const cover = g.covers.get(folder.id)}
			<a class="lrow" href={g.url(folder.id)}>
				<div class="lthumb fthumb" style:background-color={cover?.color}>
					{#if cover}
						<img src={cover.thumb} alt="" loading="lazy" decoding="async" />
						<span class="fcorner"><Icon name="folder" size={14} /></span>
					{:else}
						<Icon name="folder" size={28} />
					{/if}
				</div>
				<div class="lname">{folder.name}</div>
				<span class="lcell date">{countLabel(folder.id)}</span>
				<span class="lcell dims"></span>
				<span class="lcell size"></span>
			</a>
		{/each}
		{#each g.visible as item (item.id)}
			<a
				class="lrow"
				class:picked={g.selected.has(item.id)}
				href="?img={item.id}"
				onclick={(e) => open(e, item.id)}
			>
				<div class="lthumb" style:background-color={item.color}>
					<img src={item.thumb} alt="" loading="lazy" decoding="async" />
					{@render mark(item.id)}
				</div>
				<div class="lname">
					{item.name}
					{#if item.animated}<span class="badge">GIF</span>{/if}
				</div>
				<time class="lcell date" datetime={item.uploadedAt}>
					{g.ready ? formatDate(item.uploadedAt) : ''}
				</time>
				<span class="lcell dims">{item.width}×{item.height}</span>
				<span class="lcell size">{formatSize(item.size)}</span>
			</a>
		{/each}
	</div>
{/if}

<style>
	a {
		color: inherit;
		text-decoration: none;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* ---------- folders and selection ---------- */

	.folder-frame {
		position: relative;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		background: var(--panel);
		color: var(--accent);
		transition: background 0.2s;
	}

	.tile:hover .folder-frame {
		background: var(--panel-2);
	}

	/* A folder with a cover: the picture, dimmed at the bottom, with a folder badge. */
	.folder-cover::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(transparent 55%, rgba(0, 0, 0, 0.6));
		pointer-events: none;
	}

	.fbadge {
		position: absolute;
		left: 8px;
		bottom: 8px;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 9px 4px 7px;
		border-radius: 8px;
		background: rgba(14, 14, 17, 0.75);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		font-size: 0.75rem;
		color: #fff;
	}

	.fbadge :global(.icon) {
		color: var(--accent);
	}

	.fthumb-sm {
		width: 30px;
		height: 30px;
		overflow: hidden;
		border-radius: 6px;
		flex: none;
	}

	.fcorner {
		position: absolute;
		right: 3px;
		bottom: 3px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: rgba(14, 14, 17, 0.8);
		color: var(--accent);
	}

	.fcount {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.fstrip {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.fcard {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		max-width: 100%;
		height: 48px;
		padding: 0 14px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		color: var(--accent);
	}

	.fcard:hover {
		background: var(--panel-2);
	}

	.fname {
		overflow: hidden;
		color: var(--text);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fmeta {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.fthumb {
		display: grid;
		place-items: center;
		background: var(--panel);
		color: var(--accent);
	}

	.frame,
	.lthumb {
		position: relative;
	}

	.mark {
		position: absolute;
		top: 6px;
		left: 6px;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.35);
		color: transparent;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}

	.mark.on {
		border-color: var(--accent);
		background: var(--accent);
		color: #0b1020;
	}

	.picked .frame,
	.rtile.picked,
	.picked .lthumb {
		outline: 3px solid var(--accent);
		outline-offset: -3px;
	}

	/* ---------- grid ---------- */

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 16px 10px;
	}

	.tile {
		display: block;
		min-width: 0;
	}

	.frame {
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: var(--radius);
	}

	.frame img {
		transition: transform 0.25s ease;
	}

	.tile:hover .frame img {
		transform: scale(1.03);
	}

	.tile .caption {
		display: -webkit-box;
		margin-top: 6px;
		overflow: hidden;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		font-size: 0.82rem;
		line-height: 1.3;
		color: #cfcfd8;
		overflow-wrap: anywhere;
	}

	/* ---------- justified rows ---------- */

	.rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
	}

	.row .rtile {
		flex: 0 1 auto;
	}

	/* Before the width is known: each tile grows in proportion to its aspect
	   ratio, which keeps heights in a row roughly equal. */
	.rows-fallback {
		--row-h: 240px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.rows-fallback::after {
		content: '';
		flex-grow: 1000000;
	}

	.rows-fallback .rtile {
		flex-grow: calc(var(--ar) * 100);
		flex-basis: calc(var(--ar) * var(--row-h));
		aspect-ratio: var(--ar);
	}

	.rtile {
		position: relative;
		min-width: 0;
		overflow: hidden;
		border-radius: 6px;
	}

	.rtile .caption {
		position: absolute;
		inset: auto 0 0 0;
		padding: 20px 8px 6px;
		overflow: hidden;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
		font-size: 0.78rem;
		color: #fff;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* ---------- list ---------- */

	.list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.lrow {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) 11rem 6.5rem 4.5rem;
		align-items: center;
		gap: 16px;
		padding: 6px 8px;
		border-radius: 8px;
	}

	.lrow:hover {
		background: var(--panel);
	}

	.lthumb {
		width: 64px;
		height: 64px;
		overflow: hidden;
		border-radius: 6px;
	}

	.lname {
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.lcell {
		font-size: 0.85rem;
		color: var(--muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.date,
	.dims,
	.size {
		text-align: right;
	}

	.badge {
		display: inline-block;
		margin-left: 8px;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--panel-2);
		font-size: 0.7rem;
		color: var(--muted);
		vertical-align: 1px;
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 12px 6px;
		}
		.tile .caption {
			font-size: 0.74rem;
		}
		.rows-fallback {
			--row-h: 120px;
		}
		.lrow {
			grid-template-columns: 56px minmax(0, 1fr);
			gap: 2px 12px;
		}
		.lthumb {
			grid-row: span 2;
			width: 56px;
			height: 56px;
		}
		.lname {
			align-self: end;
		}
		.date {
			align-self: start;
			font-size: 0.78rem;
			text-align: left;
		}
		.dims,
		.size {
			display: none;
		}
	}

	@media (max-width: 360px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
