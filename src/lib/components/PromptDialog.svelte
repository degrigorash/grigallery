<script lang="ts" module>
	export interface PromptRequest {
		title: string;
		label: string;
		value: string;
		confirm: string;
		/** Throws to show an error and keep the dialog open. */
		submit: (value: string) => Promise<void>;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';

	let { request = $bindable(null) }: { request?: PromptRequest | null } = $props();

	let dialog: HTMLDialogElement;
	let input = $state<HTMLInputElement>();
	let value = $state('');
	let errorText = $state('');
	let busy = $state(false);

	$effect(() => {
		if (request && !dialog.open) {
			value = request.value;
			errorText = '';
			dialog.showModal();
			tick().then(() => input?.select());
		} else if (!request && dialog.open) {
			dialog.close();
		}
	});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!request) return;
		busy = true;
		errorText = '';
		try {
			await request.submit(value.trim());
			request = null;
		} catch (err) {
			errorText = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<dialog class="dialog" bind:this={dialog} onclose={() => (request = null)}>
	<form {onsubmit}>
		<h2>{request?.title}</h2>
		<label>
			{request?.label}
			<input class="field" bind:this={input} bind:value maxlength="100" autocomplete="off" required />
		</label>
		<p class="error" role="alert">{errorText}</p>
		<div class="dialog-actions">
			<button type="button" class="btn" onclick={() => (request = null)}>Cancel</button>
			<button class="btn primary" disabled={busy || !value.trim()}>{request?.confirm}</button>
		</div>
	</form>
</dialog>

<style>
	h2 {
		margin-bottom: 16px !important;
	}

	label {
		display: grid;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.field {
		color: var(--text);
	}

	.error {
		min-height: 1.2em;
		margin: 8px 0 0;
		font-size: 0.9rem;
		color: var(--danger);
	}
</style>
