<script lang="ts">
	import type { Gallery } from '#lib/gallery.svelte.ts';
	import type { View } from '#lib/types.ts';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		g,
		onlogin,
		onlogout,
		onupload
	}: { g: Gallery; onlogin: () => void; onlogout: () => void; onupload: () => void } = $props();

	let filtersOpen = $state(false);

	const views: { id: View; label: string; icon: IconName }[] = [
		{ id: 'grid', label: 'Grid', icon: 'grid' },
		{ id: 'rows', label: 'Rows', icon: 'rows' },
		{ id: 'list', label: 'List', icon: 'list' }
	];

	function setView(view: View) {
		g.view = view;
		g.savePrefs();
	}
</script>

<header class="topbar">
	<h1 class="logo">grigallery</h1>

	<label class="search">
		<Icon name="search" size={18} />
		<input
			type="search"
			placeholder="Search by name…"
			autocomplete="off"
			aria-label="Search by name"
			bind:value={g.query}
		/>
	</label>

	<div class="actions">
		<button
			class="icon-btn"
			class:active={filtersOpen}
			class:dot={g.filtersActive}
			title="Sort and filter"
			aria-label="Sort and filter"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = !filtersOpen)}
		>
			<Icon name="sliders" />
		</button>

		<div class="views" role="group" aria-label="View">
			{#each views as v (v.id)}
				<button
					class="icon-btn"
					class:active={g.view === v.id}
					title={v.label}
					aria-label={v.label}
					aria-pressed={g.view === v.id}
					onclick={() => setView(v.id)}
				>
					<Icon name={v.icon} />
				</button>
			{/each}
		</div>

		{#if g.user}
			<button class="btn primary upload" onclick={onupload} aria-label="Upload">
				<Icon name="upload" size={18} />
				<span class="label">Upload</span>
			</button>
			<button class="icon-btn" title="Log out" aria-label="Log out" onclick={onlogout}>
				<Icon name="logout" />
			</button>
		{:else}
			<button class="icon-btn" title="Log in" aria-label="Log in" onclick={onlogin}>
				<Icon name="user" />
			</button>
		{/if}
	</div>
</header>

{#if filtersOpen}
	<section class="filters">
		<label>
			Sort
			<select class="field" bind:value={g.sort} onchange={() => g.savePrefs()}>
				<option value="date-desc">Newest first</option>
				<option value="date-asc">Oldest first</option>
				<option value="name-asc">Name A → Z</option>
				<option value="name-desc">Name Z → A</option>
			</select>
		</label>
		<label>
			Uploaded from
			<input class="field" type="date" bind:value={g.from} max={g.to || undefined} />
		</label>
		<label>
			to
			<input class="field" type="date" bind:value={g.to} min={g.from || undefined} />
		</label>
		<button class="btn" onclick={() => g.resetFilters()}>Reset</button>
	</section>
{/if}

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
		padding: max(10px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 10px
			max(16px, env(safe-area-inset-left));
		border-bottom: 1px solid var(--line);
		background: rgba(14, 14, 17, 0.88);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.logo {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 650;
		letter-spacing: 0.02em;
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1 1 240px;
		min-width: 0;
		max-width: 520px;
		color: var(--muted);
	}

	.search :global(.icon) {
		position: absolute;
		left: 12px;
		pointer-events: none;
	}

	.search input {
		width: 100%;
		height: 38px;
		padding: 0 14px 0 38px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--panel);
		color: var(--text);
		outline: none;
	}

	.search input:focus {
		border-color: var(--accent);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}

	.views {
		display: flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--line);
		border-radius: 11px;
		background: var(--panel);
	}

	.views .icon-btn {
		width: 34px;
		height: 32px;
		border-radius: 8px;
	}

	.dot::after {
		content: '';
		position: absolute;
		top: 7px;
		right: 7px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 10px 16px;
		padding: 12px max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left));
		border-bottom: 1px solid var(--line);
		background: var(--panel);
	}

	.filters label {
		display: grid;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.filters .field {
		height: 36px;
		color: var(--text);
	}

	@media (max-width: 640px) {
		.topbar {
			gap: 8px 10px;
		}
		.search {
			order: 3;
			flex-basis: 100%;
			max-width: none;
		}
		.actions {
			gap: 4px;
		}
		.upload {
			width: 38px;
			padding: 0;
		}
		.upload .label {
			display: none;
		}
		.filters label {
			flex: 1 1 140px;
		}
	}
</style>
