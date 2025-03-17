<script lang="ts">
import { onMount } from 'svelte';
import type { Images, ImageResponse } from "../../../src/types"
import Galery from './Galery.svelte';
	import {validateWSMessage} from '../functions'

var start = performance.now()
var images  = $state<Images>({ status: "loading", value: [] })

function fetchImages() {
	fetch('http://localhost:3000/api/images?type=all')
		.then(res =>   res.ok ? res.json() : (console.error('Failed to fetch images:', res.statusText), null))
		.then(dataRaw => {
			console.log(`Received data: ${dataRaw}`, typeof dataRaw, dataRaw)
			var data: ImageResponse = dataRaw
			if (data === null) return
			if (data.state === "completed") {
				images.status = "complete"
				images.value = data.value!
			} else images.status = data.state
		})
}

function connectWebSocket() {
	var socket = new WebSocket(`ws://localhost:8080`);

	socket.addEventListener('message', (event) => {
		var data = JSON.parse(event.data) as unknown
		 if (validateWSMessage(data)) {
			if (data.type === 'new-images') {
				fetchImages()
			}
		}
	});

	socket.addEventListener('open', () => console.log('WebSocket connection established.'));
	socket.addEventListener('close', () => console.log('WebSocket connection closed.'));
	socket.addEventListener('error', (error) => console.error('WebSocket error:', error));
  }

onMount(() => {
	fetchImages()
	connectWebSocket()
});

</script>

<style>
:global(*) {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}
:global(body) {
	position: relative;
	display: flex;	
	flex-direction: column;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100dvh;
}

:global(#svelte) {
	width: 100%;
	height: 100%;
	display: flex;	
	flex-direction: column;
	justify-content: center;
	align-items: center;
}
.wrapper {
	width: 80%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: center;
}
</style>

<div class="wrapper">
	<h1>Image Gallery</h1>
	<Galery {images} {start} />	
</div>
