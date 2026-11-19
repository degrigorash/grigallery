<script lang="ts" module>
	// Stroke icons on a 24×24 grid, as path data only.
	const ICONS = {
		grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
		rows: ['M3 5h11v6H3z', 'M16 5h5v6h-5z', 'M3 13h6v6H3z', 'M11 13h10v6H11z'],
		list: ['M3 5h4v4H3z', 'M10 7h11', 'M3 15h4v4H3z', 'M10 17h11'],
		sliders: [
			'M4 7h9',
			'M17 7h3',
			'M4 17h3',
			'M11 17h9',
			'M15 5a2 2 0 1 1 0 4a2 2 0 1 1 0-4z',
			'M9 15a2 2 0 1 1 0 4a2 2 0 1 1 0-4z'
		],
		user: ['M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z', 'M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6'],
		logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 8l-4 4 4 4', 'M6 12h10'],
		upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
		fullscreen: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
		external: [
			'M14 4h6v6',
			'M20 4l-9 9',
			'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'
		],
		edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13 7l4 4'],
		trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
		close: ['M6 6l12 12', 'M18 6L6 18'],
		prev: ['M15 5l-7 7 7 7'],
		next: ['M9 5l7 7-7 7'],
		search: ['M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14z', 'M20 20l-4-4']
	} as const;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
	{#each ICONS[name] as d (d)}
		<path {d} />
	{/each}
</svg>

<style>
	.icon {
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
