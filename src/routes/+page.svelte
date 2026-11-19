<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { api } from '#lib/api.ts';
	import GalleryView from '#lib/components/GalleryView.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import LoginDialog from '#lib/components/LoginDialog.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import Toolbar from '#lib/components/Toolbar.svelte';
	import UploadDialog from '#lib/components/UploadDialog.svelte';
	import { Gallery } from '#lib/gallery.svelte.ts';
	import { showToast } from '#lib/toast.svelte.ts';
	import { Uploader } from '#lib/uploader.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The page owns this state from here on; later loads don't replace it.
	const g = untrack(() => new Gallery(data));
	const uploader = new Uploader(g);

	let loginOpen = $state(false);
	let dragging = $state(0);

	// The open image lives in the URL (?img=…) through shallow navigation,
	// so the back button and swipe-back close the viewer.
	const openId = $derived(page.state.img);
	const viewerOpen = $derived(!!openId && g.visible.some((it) => it.id === openId));
	let pushed = false;

	function openImage(id: string) {
		pushed = true;
		goto(`?img=${id}`, { shallow: true, state: { img: id } });
	}

	function showImage(id: string) {
		return goto(`?img=${id}`, { shallow: true, replace: true, state: { img: id } });
	}

	function closeImage() {
		if (pushed) {
			pushed = false;
			history.back();
		} else {
			goto(page.url.pathname, { shallow: true, replace: true, state: {} });
		}
	}

	onMount(() => {
		g.ready = true;
		// A shared link like /?img=… opens straight into the viewer.
		const id = page.url.searchParams.get('img');
		if (id && g.items.some((it) => it.id === id)) showImage(id);
		else if (id) closeImage();
	});

	// An open image that disappears (deleted, filtered out) closes the viewer, once.
	let closedFor: string | undefined;
	$effect(() => {
		if (openId && !viewerOpen && closedFor !== openId) {
			closedFor = openId;
			untrack(closeImage);
		}
	});

	async function logout() {
		await api('POST', '/api/logout').catch(() => {});
		g.user = null;
		showToast('Logged out');
	}

	function login(user: string) {
		g.user = user;
		showToast('Logged in');
	}

	const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

	function ondragenter(e: DragEvent) {
		if (g.user && hasFiles(e)) dragging++;
	}

	function ondragleave(e: DragEvent) {
		if (g.user && hasFiles(e)) dragging = Math.max(0, dragging - 1);
	}

	function ondragover(e: DragEvent) {
		if (g.user && hasFiles(e)) e.preventDefault();
	}

	function ondrop(e: DragEvent) {
		if (!g.user || !hasFiles(e)) return;
		e.preventDefault();
		dragging = 0;
		if (e.dataTransfer?.files.length) uploader.enqueue(e.dataTransfer.files);
	}

	function onpaste(e: ClipboardEvent) {
		if (!g.user) return;
		if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
		const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		e.preventDefault();
		uploader.enqueue(files, { pasted: true });
	}

	const total = $derived(g.items.length);
	const shown = $derived(g.visible.length);
</script>

<svelte:window {ondragenter} {ondragleave} {ondragover} {ondrop} {onpaste} />

<Toolbar
	{g}
	onlogin={() => (loginOpen = true)}
	onlogout={logout}
	onupload={() => (uploader.open = true)}
/>

<main>
	<p class="status">
		{#if !total}
			{g.user
				? 'No images yet. Press Upload, drop files here, or paste a screenshot.'
				: 'No images yet.'}
		{:else if shown === total}
			{total} {total === 1 ? 'image' : 'images'}
		{:else}
			{shown} of {total} images
		{/if}
	</p>
	<GalleryView {g} onopen={openImage} />
</main>

{#if viewerOpen && openId}
	<Lightbox {g} id={openId} onclose={closeImage} onnavigate={showImage} />
{/if}

<LoginDialog bind:open={loginOpen} onlogin={login} />
<UploadDialog {uploader} />
<Toast />

{#if dragging && !uploader.open}
	<div class="drop-overlay">Drop images to upload</div>
{/if}

<style>
	main {
		padding: 12px max(12px, env(safe-area-inset-right)) 48px max(12px, env(safe-area-inset-left));
	}

	.status {
		margin: 4px 4px 12px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		border: 3px dashed var(--accent);
		background: rgba(14, 14, 17, 0.85);
		font-size: 1.3rem;
		pointer-events: none;
	}
</style>
