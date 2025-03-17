<script lang="ts">
	import type { Images } from "../../../src/types"

	var { images, start }: { images: Images, start: number } = $props()
</script>

<style>

div.gallery {
	flex: 1 1;
	position: inherit;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
	gap: 10px;
}
.gallery img {
	width: 100%;
	height: auto;
	object-fit: cover;
	border-radius: 5px;
	box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
}
</style>

<div class="gallery">
	{#if images.status === "complete"}
		{#each images.value as image, idx}
			<img src={`http://localhost:3000${image}`} alt={image} onload={idx === images.value.length - 1 ? () => {
				var end = performance.now()
				console.log(`Took ${(end - start).toFixed(2)} ms to render whole page to last image`)
			} : undefined} />
		{/each}
	{:else if images.status === "loading"}
		<p>Loading images...</p>
	{:else if images.status === "no-content"}
		<p>No images provided</p>
	{:else if images.status === "cache-disabled"}
		<p>Cache is disabled. No images</p>
	{/if}
</div>
