<script lang="ts">
	import { toast } from '#lib/toast.svelte.ts';
</script>

<div class="toast" class:show={toast.visible} role="status" aria-live="polite">{toast.message}</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		top: calc(max(10px, env(safe-area-inset-top)) + 56px);
		z-index: 300;
		max-width: calc(100vw - 32px);
		padding: 10px 16px;
		border-radius: 10px;
		background: #2b2b35;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
		opacity: 0;
		transform: translate(-50%, -12px);
		transition:
			opacity 0.2s,
			transform 0.2s;
		pointer-events: none;
	}

	.show {
		opacity: 1;
		transform: translate(-50%, 0);
	}
</style>
