<script lang="ts">
	import { api } from '#lib/api.ts';

	let { open = $bindable(false), onlogin }: { open?: boolean; onlogin: (user: string) => void } =
		$props();

	let dialog: HTMLDialogElement;
	let username = $state('');
	let password = $state('');
	let errorText = $state('');
	let busy = $state(false);

	$effect(() => {
		if (open && !dialog.open) {
			errorText = '';
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		errorText = '';
		try {
			const res = await api<{ user: string }>('POST', '/api/login', {
				username: username.trim(),
				password
			});
			password = '';
			open = false;
			onlogin(res.user);
		} catch (err) {
			errorText = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<dialog class="dialog" bind:this={dialog} onclose={() => (open = false)}>
	<form onsubmit={submit}>
		<h2>Log in</h2>
		<label>
			Username
			<input class="field" bind:value={username} autocomplete="username" autocapitalize="off" required />
		</label>
		<label>
			Password
			<input class="field" type="password" bind:value={password} autocomplete="current-password" required />
		</label>
		<p class="error" role="alert">{errorText}</p>
		<div class="dialog-actions">
			<button type="button" class="btn" onclick={() => (open = false)}>Cancel</button>
			<button class="btn primary" disabled={busy}>Log in</button>
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
		margin-bottom: 12px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.field {
		color: var(--text);
	}

	.error {
		min-height: 1.2em;
		margin: 0;
		font-size: 0.9rem;
		color: var(--danger);
	}
</style>
