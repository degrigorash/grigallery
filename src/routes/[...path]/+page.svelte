<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { api } from '#lib/api.ts';
	import FolderPicker, { type PickRequest } from '#lib/components/FolderPicker.svelte';
	import GalleryView from '#lib/components/GalleryView.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import LoginDialog from '#lib/components/LoginDialog.svelte';
	import PathBar from '#lib/components/PathBar.svelte';
	import PromptDialog, { type PromptRequest } from '#lib/components/PromptDialog.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import Toolbar from '#lib/components/Toolbar.svelte';
	import UploadDialog from '#lib/components/UploadDialog.svelte';
	import { Gallery } from '#lib/gallery.svelte.ts';
	import { showToast } from '#lib/toast.svelte.ts';
	import type { GalleryFolder } from '#lib/types.ts';
	import { Uploader } from '#lib/uploader.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The page owns this state from here on; later loads only tell it which
	// folder to show (the route stays mounted while moving between folders).
	const g = untrack(() => new Gallery(data));
	const uploader = new Uploader(g);

	$effect.pre(() => {
		const id = data.folderId;
		untrack(() => (g.folderId = id));
	});

	let loginOpen = $state(false);
	let dragging = $state(0);
	let prompt = $state<PromptRequest | null>(null);
	let picker = $state<PickRequest | null>(null);

	// ---------- viewer ----------
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
		// A shared link like /anime?img=… opens straight into the viewer.
		const id = page.url.searchParams.get('img');
		if (id && g.visible.some((it) => it.id === id)) showImage(id);
		else if (id) closeImage();
	});

	// An open image that disappears (deleted, moved, filtered out) closes the viewer, once.
	let closedFor: string | undefined;
	$effect(() => {
		if (openId && !viewerOpen && closedFor !== openId) {
			closedFor = openId;
			untrack(closeImage);
		}
	});

	/**
	 * Before pictures leave the current view, step the viewer onto a picture
	 * that stays, so it doesn't close under the user's hands.
	 */
	async function stepAwayFrom(ids: string[]) {
		if (!viewerOpen || !openId || !ids.includes(openId)) return;
		const list = g.visible;
		const at = list.findIndex((it) => it.id === openId);
		const leaving = new Set(ids);
		const stay = (i: number) => list[i] && !leaving.has(list[i].id);
		let next = -1;
		for (let i = at + 1; i < list.length && next < 0; i++) if (stay(i)) next = i;
		for (let i = at - 1; i >= 0 && next < 0; i--) if (stay(i)) next = i;
		if (next >= 0) await showImage(list[next].id);
	}

	// ---------- pictures ----------

	/** Would a picture moved into target still be shown here? */
	function staysVisible(target: string | null) {
		if (g.searching) return g.subtree === null || (target !== null && g.subtree.has(target));
		return target === g.folderId;
	}

	function moveImages(ids: string[]) {
		const folders = new Set(g.items.filter((it) => ids.includes(it.id)).map((it) => it.folderId));
		picker = {
			title: ids.length === 1 ? 'Move to folder' : `Move ${ids.length} images to`,
			from: folders.size === 1 ? [...folders][0] : undefined,
			pick: async (target) => {
				await api('POST', '/api/images/batch', { action: 'move', ids, folderId: target });
				if (!staysVisible(target)) await stepAwayFrom(ids);
				g.moveItems(ids, target);
				for (const id of ids) g.selected.delete(id);
				if (!g.selected.size) g.stopSelecting();
				showToast(`Moved to ${g.pathLabel(target)}`);
			}
		};
	}

	async function deleteImages(ids: string[]) {
		const one = ids.length === 1 ? g.items.find((it) => it.id === ids[0]) : undefined;
		const question = one
			? `Delete “${one.name}”? This can't be undone.`
			: `Delete ${ids.length} images? This can't be undone.`;
		if (!confirm(question)) return;
		try {
			await api('POST', '/api/images/batch', { action: 'delete', ids });
		} catch (err) {
			showToast((err as Error).message);
			return;
		}
		await stepAwayFrom(ids);
		g.remove(ids);
		if (!g.selected.size) g.stopSelecting();
		showToast(ids.length === 1 ? 'Deleted' : `Deleted ${ids.length} images`);
	}

	// ---------- folders ----------

	/** Makes a picture the open folder's cover, or goes back to automatic if it already is. */
	async function toggleCover(imageId: string) {
		const folder = g.current;
		if (!folder) return;
		const coverId = folder.coverId === imageId ? null : imageId;
		try {
			const updated = await api<GalleryFolder>('PATCH', `/api/folders/${folder.id}`, { coverId });
			g.upsertFolder(updated);
			showToast(coverId ? `Cover of “${folder.name}”` : 'Cover is the newest picture again');
		} catch (err) {
			showToast((err as Error).message);
		}
	}

	function newFolder() {
		prompt = {
			title: 'New folder',
			label: `In ${g.pathLabel(g.folderId)}`,
			value: '',
			confirm: 'Create',
			submit: async (name) => {
				const folder = await api<GalleryFolder>('POST', '/api/folders', {
					name,
					parentId: g.folderId
				});
				g.upsertFolder(folder);
				showToast(`Folder “${folder.name}” created`);
			}
		};
	}

	function renameFolder() {
		const folder = g.current;
		if (!folder) return;
		prompt = {
			title: 'Rename folder',
			label: 'Name',
			value: folder.name,
			confirm: 'Rename',
			submit: async (name) => {
				const updated = await api<GalleryFolder>('PATCH', `/api/folders/${folder.id}`, { name });
				g.upsertFolder(updated);
				await goto(g.url(updated.id), { replace: true });
			}
		};
	}

	function moveFolder() {
		const folder = g.current;
		if (!folder) return;
		picker = {
			title: `Move “${folder.name}” to`,
			from: folder.parentId,
			exclude: folder.id,
			pick: async (target) => {
				const updated = await api<GalleryFolder>('PATCH', `/api/folders/${folder.id}`, {
					parentId: target
				});
				g.upsertFolder(updated);
				await goto(g.url(updated.id), { replace: true });
				showToast(`Moved to ${g.pathLabel(target)}`);
			}
		};
	}

	async function deleteFolder() {
		const folder = g.current;
		if (!folder) return;
		const parent = g.pathLabel(folder.parentId);
		if (!confirm(`Delete folder “${folder.name}”? What's inside moves to ${parent}.`)) return;
		try {
			await api('DELETE', `/api/folders/${folder.id}`);
		} catch (err) {
			showToast((err as Error).message);
			return;
		}
		const parentUrl = g.url(folder.parentId);
		await goto(parentUrl, { replace: true });
		g.removeFolder(folder.id);
		showToast(`Folder deleted, its contents are in ${parent}`);
	}

	// ---------- auth ----------

	async function logout() {
		await api('POST', '/api/logout').catch(() => {});
		g.user = null;
		g.stopSelecting();
		showToast('Logged out');
	}

	function login(user: string) {
		g.user = user;
		showToast('Logged in');
	}

	// ---------- drag and drop, paste, keys ----------

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

	// Reset on every drop, wherever it lands: the upload dialog's drop zone
	// stops the event from reaching ondrop below, which used to leave the
	// overlay stuck after the dialog closed.
	function endDrag() {
		dragging = 0;
	}

	$effect(() => {
		if (uploader.open) untrack(endDrag);
	});

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

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !g.selecting || viewerOpen) return;
		if (document.querySelector('dialog[open]')) return;
		g.stopSelecting();
	}

	const empty = $derived(!g.visible.length && !g.visibleFolders.length);
	const allPicked = $derived(g.visible.length > 0 && g.visible.every((it) => g.selected.has(it.id)));
</script>

<svelte:window
	{ondragenter}
	{ondragleave}
	{ondragover}
	{ondrop}
	ondropcapture={endDrag}
	ondragend={endDrag}
	{onpaste}
	{onkeydown}
/>

<svelte:head>
	{#if g.current}<title>{g.current.name} · grigallery</title>{/if}
</svelte:head>

<Toolbar
	{g}
	onlogin={() => (loginOpen = true)}
	onlogout={logout}
	onupload={() => uploader.show()}
/>

<main class:selecting={g.selecting}>
	<PathBar
		{g}
		onnewfolder={newFolder}
		onrename={renameFolder}
		onmove={moveFolder}
		ondelete={deleteFolder}
	/>
	{#if empty}
		<p class="empty">
			{#if g.searching}
				Nothing found.
			{:else if g.user}
				Empty. Upload images, drop or paste them here, or create a folder.
			{:else}
				Nothing here yet.
			{/if}
		</p>
	{/if}
	<GalleryView {g} onopen={openImage} />
</main>

{#if g.selecting}
	<div class="selbar" role="toolbar" aria-label="Selected images">
		<span class="count">{g.selected.size} selected</span>
		<button
			class="btn"
			onclick={() =>
				allPicked ? g.selected.clear() : g.visible.forEach((it) => g.selected.add(it.id))}
		>
			{allPicked ? 'None' : 'All'}
		</button>
		<button class="btn" disabled={!g.selected.size} onclick={() => moveImages([...g.selected])}>
			<Icon name="move" size={18} /><span class="label">Move</span>
		</button>
		<button class="btn danger" disabled={!g.selected.size} onclick={() => deleteImages([...g.selected])}>
			<Icon name="trash" size={18} /><span class="label">Delete</span>
		</button>
		<button class="icon-btn" aria-label="Stop selecting" title="Done (Esc)" onclick={() => g.stopSelecting()}>
			<Icon name="close" />
		</button>
	</div>
{/if}

{#if viewerOpen && openId}
	<Lightbox
		{g}
		id={openId}
		onclose={closeImage}
		onnavigate={showImage}
		onmove={(id) => moveImages([id])}
		ondelete={(id) => deleteImages([id])}
		oncover={toggleCover}
	/>
{/if}

<LoginDialog bind:open={loginOpen} onlogin={login} />
<UploadDialog {uploader} {g} />
<PromptDialog bind:request={prompt} />
<FolderPicker {g} bind:request={picker} />
<Toast />

{#if dragging && !uploader.open}
	<div class="drop-overlay">Drop images to upload to {g.pathLabel(g.folderId)}</div>
{/if}

<style>
	main {
		padding: 10px max(12px, env(safe-area-inset-right)) 48px max(12px, env(safe-area-inset-left));
	}

	main.selecting {
		padding-bottom: 110px;
	}

	.empty {
		margin: 24px 4px;
		color: var(--muted);
	}

	.selbar {
		position: fixed;
		left: 50%;
		bottom: max(16px, env(safe-area-inset-bottom));
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: calc(100vw - 24px);
		padding: 8px 8px 8px 16px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--panel);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
		transform: translateX(-50%);
	}

	.count {
		margin-right: 4px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.danger {
		color: var(--danger);
	}

	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 24px;
		border: 3px dashed var(--accent);
		background: rgba(14, 14, 17, 0.85);
		font-size: 1.3rem;
		text-align: center;
		pointer-events: none;
	}

	@media (max-width: 640px) {
		.selbar {
			left: 12px;
			right: 12px;
			gap: 6px;
			transform: none;
		}
		.selbar .label {
			display: none;
		}
		.count {
			flex: 1;
		}
	}
</style>
