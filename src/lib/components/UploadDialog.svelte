<script lang="ts">
	import { formatSize } from '#lib/format.ts';
	import type { Uploader } from '#lib/uploader.svelte.ts';
	import Icon from './Icon.svelte';

	import type { Gallery } from '#lib/gallery.svelte.ts';

	let { uploader, g }: { uploader: Uploader; g: Gallery } = $props();

	let dialog: HTMLDialogElement;
	let over = $state(false);

	$effect(() => {
		if (uploader.open && !dialog.open) dialog.showModal();
		else if (!uploader.open && dialog.open) dialog.close();
	});

	function onclose() {
		uploader.open = false;
		uploader.clear();
	}

	function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files?.length) uploader.enqueue(input.files);
		input.value = '';
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		over = false;
		if (e.dataTransfer?.files.length) uploader.enqueue(e.dataTransfer.files);
	}
</script>

<dialog class="dialog upload" bind:this={dialog} {onclose}>
	<div class="head">
		<h2>Upload</h2>
		<button class="icon-btn" aria-label="Close" onclick={() => (uploader.open = false)}>
			<Icon name="close" />
		</button>
	</div>

	<label class="dest">
		<span>Upload to</span>
		<select class="field" bind:value={uploader.destination} disabled={uploader.busy}>
			{#each g.options as opt (opt.id)}
				<option value={opt.id}>{'\u00a0\u00a0'.repeat(opt.depth)}{opt.label}</option>
			{/each}
		</select>
	</label>

	<label
		class="dropzone"
		class:over
		ondragover={(e) => {
			e.preventDefault();
			over = true;
		}}
		ondragleave={() => (over = false)}
		ondrop={drop}
	>
		<input
			class="visually-hidden"
			type="file"
			multiple
			accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
			onchange={pick}
		/>
		<span>
			<strong>Choose images</strong> or drop them here<br />
			<small>You can also paste a screenshot with Ctrl+V</small>
		</span>
	</label>

	{#if uploader.queue.length}
		<ul class="queue">
			{#each uploader.queue as entry (entry.key)}
				<li class="item {entry.status}">
					<img src={entry.preview} alt="" />
					<div class="body">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="field name"
							bind:value={entry.name}
							placeholder="Name — where is it from?"
							aria-label="Name"
							maxlength="300"
							disabled={entry.status === 'uploading' || entry.status === 'done'}
							autofocus={entry.pasted}
						/>
						<div class="bar"><div class="fill" style:width="{entry.progress * 100}%"></div></div>
						<div class="msg">{entry.message || formatSize(entry.file.size)}</div>
					</div>
					<button
						class="icon-btn"
						aria-label="Remove"
						title="Remove"
						disabled={entry.status === 'uploading'}
						onclick={() => uploader.remove(entry)}
					>
						<Icon name="close" size={18} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="dialog-actions">
		<button class="btn" disabled={uploader.busy || !uploader.queue.length} onclick={() => uploader.clear(true)}>
			Clear
		</button>
		<button class="btn primary" disabled={uploader.busy || !uploader.pending} onclick={() => uploader.start()}>
			{uploader.busy ? 'Uploading…' : 'Upload'}
		</button>
	</div>
</dialog>

<style>
	.upload {
		width: min(620px, calc(100vw - 24px)) !important;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.dest {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.dest .field {
		flex: 1;
		min-width: 0;
		color: var(--text);
	}

	.dropzone {
		display: grid;
		place-items: center;
		padding: 28px 16px;
		border: 2px dashed var(--line);
		border-radius: 12px;
		color: var(--muted);
		text-align: center;
		line-height: 1.5;
		cursor: pointer;
	}

	.dropzone strong {
		color: var(--accent);
	}

	.dropzone:hover,
	.dropzone.over {
		border-color: var(--accent);
		color: var(--text);
	}

	.dropzone:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.queue {
		display: grid;
		gap: 10px;
		max-height: 50vh;
		margin: 12px 0 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}

	.item {
		display: grid;
		grid-template-columns: 52px minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
	}

	.item > img {
		width: 52px;
		height: 52px;
		border-radius: 6px;
		background: var(--panel-2);
		object-fit: cover;
	}

	.name {
		width: 100%;
		height: 34px;
		color: var(--text);
	}

	.bar {
		height: 3px;
		margin-top: 6px;
		overflow: hidden;
		border-radius: 2px;
		background: var(--panel-2);
	}

	.fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.15s;
	}

	.msg {
		margin-top: 4px;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.done .msg {
		color: var(--ok);
	}

	.done .fill {
		background: var(--ok);
	}

	.error .msg {
		color: var(--danger);
	}

	.duplicate .msg {
		color: var(--warn);
	}
</style>
