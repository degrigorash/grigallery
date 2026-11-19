<script lang="ts">
	import { api } from '#lib/api.ts';
	import { formatDate, formatSize } from '#lib/format.ts';
	import type { Gallery } from '#lib/gallery.svelte.ts';
	import { showToast } from '#lib/toast.svelte.ts';
	import type { GalleryImage } from '#lib/types.ts';
	import { onMount, tick } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		g,
		id,
		onclose,
		onnavigate
	}: {
		g: Gallery;
		id: string;
		onclose: () => unknown;
		onnavigate: (id: string) => unknown;
	} = $props();

	let root = $state<HTMLDivElement>();
	let nameInput = $state<HTMLInputElement>();
	let chromeHidden = $state(false);
	let renaming = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let loadedUrl = $state<string | null>(null);
	let canFullscreen = $state(false);

	const index = $derived(g.visible.findIndex((it) => it.id === id));
	const item = $derived<GalleryImage | undefined>(g.visible[index]);
	const prevItem = $derived(index > 0 ? g.visible[index - 1] : undefined);
	const nextItem = $derived(index >= 0 ? g.visible[index + 1] : undefined);

	// Show the thumbnail at once, swap in the sharp original when it has loaded.
	$effect(() => {
		const url = item?.url;
		if (!url) return;
		const full = new Image();
		full.onload = () => (loadedUrl = url);
		full.src = url;
		for (const n of [prevItem, nextItem]) if (n) new Image().src = n.thumb;
		return () => (full.onload = null);
	});

	// Leaving the current image cancels a rename in progress.
	$effect(() => {
		void id;
		renaming = false;
	});

	onMount(() => {
		canFullscreen = document.fullscreenEnabled;
		document.body.classList.add('no-scroll');
		return () => {
			document.body.classList.remove('no-scroll');
			if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		};
	});

	function step(delta: number) {
		const target = g.visible[index + delta];
		if (target) onnavigate(target.id);
	}

	function toggleFullscreen() {
		if (!document.fullscreenEnabled) return;
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		else root?.requestFullscreen().catch(() => {});
	}

	async function startRename() {
		if (!item) return;
		draft = item.name;
		renaming = true;
		await tick();
		nameInput?.focus();
		nameInput?.select();
	}

	async function saveRename(e: SubmitEvent) {
		e.preventDefault();
		if (!item) return;
		const name = draft.trim();
		if (!name || name === item.name) {
			renaming = false;
			return;
		}
		saving = true;
		try {
			g.update(await api<GalleryImage>('PATCH', `/api/images/${item.id}`, { name }));
			renaming = false;
		} catch (err) {
			showToast((err as Error).message);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		const target = item;
		if (!target || !confirm(`Delete “${target.name}”? This can't be undone.`)) return;
		const neighbour = nextItem ?? prevItem;
		try {
			await api('DELETE', `/api/images/${target.id}`);
		} catch (err) {
			showToast((err as Error).message);
			return;
		}
		// Move on first, so the viewer doesn't see its image vanish and close.
		if (neighbour) await onnavigate(neighbour.id);
		g.remove(target.id);
		showToast('Deleted');
	}

	function onkeydown(e: KeyboardEvent) {
		if (document.querySelector('dialog[open]')) return;
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, select')) {
			if (e.key === 'Escape') {
				renaming = false;
				e.preventDefault();
			}
			return;
		}
		if (e.key === 'ArrowLeft') step(-1);
		else if (e.key === 'ArrowRight') step(1);
		else if (e.key === 'Escape') onclose();
		else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
		else return;
		e.preventDefault();
	}

	// Swipe left/right to move, down to close; ignored while pinch-zoomed.
	let touch: { x: number; y: number } | null = null;

	function ontouchstart(e: TouchEvent) {
		const zoomed = (window.visualViewport?.scale ?? 1) > 1.01;
		const onControl = (e.target as HTMLElement).closest('button, a, form');
		touch =
			e.touches.length === 1 && !zoomed && !onControl
				? { x: e.touches[0].clientX, y: e.touches[0].clientY }
				: null;
	}

	function ontouchend(e: TouchEvent) {
		if (!touch) return;
		const t = e.changedTouches[0];
		const dx = t.clientX - touch.x;
		const dy = t.clientY - touch.y;
		touch = null;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
		else if (dy > 90 && dy > Math.abs(dx) * 1.5) onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if item}
	<div
		class="lightbox"
		class:chrome-hidden={chromeHidden}
		role="dialog"
		aria-modal="true"
		aria-label={item.name}
		tabindex="-1"
		bind:this={root}
		{ontouchstart}
		{ontouchend}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="stage" onclick={(e) => e.target === e.currentTarget && onclose()}>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
			<img
				src={loadedUrl === item.url ? item.url : item.thumb}
				alt={item.name}
				width={item.width}
				height={item.height}
				style:background-color={loadedUrl === item.url ? 'transparent' : item.color}
				onclick={() => (chromeHidden = !chromeHidden)}
			/>
		</div>

		<button class="nav prev" aria-label="Previous" disabled={!prevItem} onclick={() => step(-1)}>
			<Icon name="prev" size={28} />
		</button>
		<button class="nav next" aria-label="Next" disabled={!nextItem} onclick={() => step(1)}>
			<Icon name="next" size={28} />
		</button>

		<div class="top">
			<span class="counter">{index + 1} / {g.visible.length}</span>
			<div class="tools">
				{#if canFullscreen}
					<button class="icon-btn" title="Fullscreen (F)" aria-label="Fullscreen" onclick={toggleFullscreen}>
						<Icon name="fullscreen" />
					</button>
				{/if}
				<a class="icon-btn" href={item.url} target="_blank" rel="noopener" title="Open original" aria-label="Open original">
					<Icon name="external" />
				</a>
				{#if g.user}
					<button class="icon-btn" title="Rename" aria-label="Rename" onclick={startRename}>
						<Icon name="edit" />
					</button>
					<button class="icon-btn" title="Delete" aria-label="Delete" onclick={remove}>
						<Icon name="trash" />
					</button>
				{/if}
				<button class="icon-btn" title="Close (Esc)" aria-label="Close" onclick={onclose}>
					<Icon name="close" />
				</button>
			</div>
		</div>

		<div class="caption">
			{#if renaming}
				<form class="rename" onsubmit={saveRename}>
					<input
						class="field"
						bind:this={nameInput}
						bind:value={draft}
						maxlength="300"
						aria-label="Name"
						autocomplete="off"
					/>
					<button class="btn primary" disabled={saving}>Save</button>
					<button class="btn" type="button" onclick={() => (renaming = false)}>Cancel</button>
				</form>
			{:else}
				<div class="name">{item.name}</div>
			{/if}
			<div class="meta">
				{formatDate(item.uploadedAt)} · {item.width}×{item.height} · {formatSize(item.size)}
			</div>
		</div>
	</div>
{/if}

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: #050507;
		outline: none;
	}

	.stage {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 60px 16px 96px;
		transition: padding 0.2s;
	}

	.stage img {
		/* width/height attributes carry the original size, so the box doesn't
		   jump when the original replaces the thumbnail; contain keeps the shape. */
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		user-select: none;
		-webkit-user-select: none;
		-webkit-user-drag: none;
	}

	.chrome-hidden .stage {
		padding: 0;
	}

	.top,
	.caption,
	.nav {
		transition: opacity 0.2s;
	}

	.chrome-hidden .top,
	.chrome-hidden .caption,
	.chrome-hidden .nav {
		opacity: 0;
		pointer-events: none;
	}

	.top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 10px
			max(10px, env(safe-area-inset-left));
		background: linear-gradient(rgba(0, 0, 0, 0.6), transparent);
	}

	.counter {
		padding-left: 6px;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.tools {
		display: flex;
		gap: 2px;
	}

	.tools .icon-btn {
		color: #ddd;
	}

	.caption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 32px max(20px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom))
			max(20px, env(safe-area-inset-left));
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
		text-align: center;
	}

	.name {
		max-width: 900px;
		margin: 0 auto;
		font-size: 1.05rem;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.meta {
		margin-top: 4px;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.rename {
		display: flex;
		gap: 8px;
		max-width: 720px;
		margin: 0 auto;
	}

	.rename .field {
		flex: 1;
		min-width: 0;
		height: 38px;
		background: var(--panel);
	}

	.nav {
		position: absolute;
		top: 50%;
		display: grid;
		place-items: center;
		width: 48px;
		height: 72px;
		border: 0;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
		transform: translateY(-50%);
	}

	.nav:hover {
		background: rgba(255, 255, 255, 0.14);
	}

	.nav:disabled {
		opacity: 0;
		pointer-events: none;
	}

	.prev {
		left: max(12px, env(safe-area-inset-left));
	}

	.next {
		right: max(12px, env(safe-area-inset-right));
	}

	/* Touch screens navigate by swiping. */
	@media (hover: none) {
		.nav {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.stage {
			padding: 56px 0 104px;
		}
		.rename {
			flex-wrap: wrap;
		}
		.rename .field {
			flex-basis: 100%;
		}
	}
</style>
