<script>
	import { userState } from '$lib/state/editor.svelte.js';
	import { isTouchDevice } from '$lib/assets/js/mobile-utils.js';

	let fileInput = $state(null);
	let cameraInput = $state(null);
	let urlInput = $state('');
	let showUrlInput = $state(false);
	let isDragging = $state(false);

	function handleFileSelect(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		loadImageFile(file);
		event.target.value = '';
	}

	function loadImageFile(file) {
		if (!file.type.startsWith('image/')) {
			alert('Bitte wähle eine Bilddatei (JPG, PNG, etc.)');
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				userState.topo.image2D = e.target.result;
				userState.topo.imageAspectRatio = img.width / img.height;
			};
			img.src = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	function handleUrlLoad() {
		if (!urlInput.trim()) return;

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0);
			userState.topo.image2D = canvas.toDataURL();
			userState.topo.imageAspectRatio = img.width / img.height;
			showUrlInput = false;
			urlInput = '';
		};
		img.onerror = () => {
			alert('Fehler beim Laden des Bildes. Überprüfe die URL.');
		};
		img.src = urlInput;
	}

	function handleDrop(event) {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer.files?.[0];
		if (file) loadImageFile(file);
	}

	function handleDragOver(event) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function removeImage() {
		userState.topo.image2D = null;
		userState.topo.imageAspectRatio = 1.5;
	}

	async function handleCameraCapture() {
		if (isTouchDevice()) {
			cameraInput?.click();
			return;
		}

		// Desktop: Use webcam modal (restored logic)
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});

			const video = document.createElement('video');
			video.srcObject = stream;
			video.play();

			// Create a simple modal for camera preview
			const modal = document.createElement('div');
			modal.style.cssText =
				'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';

			video.style.cssText = 'max-width:90%;max-height:80%;';
			modal.appendChild(video);

			const captureBtn = document.createElement('button');
			captureBtn.textContent = 'Foto aufnehmen';
			captureBtn.style.cssText = 'margin-top:20px;padding:10px 20px;font-size:16px;';
			captureBtn.onclick = () => {
				const canvas = document.createElement('canvas');
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				canvas.getContext('2d').drawImage(video, 0, 0);
				userState.topo.image2D = canvas.toDataURL();
				userState.topo.imageAspectRatio = canvas.width / canvas.height;
				stream.getTracks().forEach((track) => track.stop());
				document.body.removeChild(modal);
			};
			modal.appendChild(captureBtn);

			const cancelBtn = document.createElement('button');
			cancelBtn.textContent = 'Abbrechen';
			cancelBtn.style.cssText = 'margin-top:10px;padding:10px 20px;';
			cancelBtn.onclick = () => {
				stream.getTracks().forEach((track) => track.stop());
				document.body.removeChild(modal);
			};
			modal.appendChild(cancelBtn);

			document.body.appendChild(modal);
		} catch (err) {
			alert('Kamera-Zugriff fehlgeschlagen: ' + err.message);
		}
	}
</script>

{#if userState.topo.image2D}
	<div class="bg-white rounded-2xl shadow-md p-4 mb-3 border border-gray-200">
		<div class="flex items-center justify-between mb-2">
			<h4 class="text-sm font-semibold text-gray-700">Hintergrundbild</h4>
			<button class="text-red-500 hover:text-red-700 text-sm" onclick={removeImage}>
				<i class="fa-solid fa-trash-can"></i> Entfernen
			</button>
		</div>
		<img
			src={userState.topo.image2D}
			alt="Topo background"
			class="max-w-2xs rounded-lg border border-gray-200"
		/>
	</div>
{:else}
	<div class="bg-white rounded-2xl shadow-md p-5 mb-3 border border-gray-200">
		<h4 class="text-sm font-semibold text-gray-700 mb-3">Hintergrundbild laden</h4>

		<div
			class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {isDragging
				? 'border-blue-500 bg-blue-50'
				: 'border-gray-300'}"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
		>
			<i class="fa-solid fa-image text-4xl text-gray-400 mb-3"></i>
			<p class="text-sm text-gray-600 mb-4">Bild hierher ziehen oder</p>

			<div class="flex flex-col gap-2">
				<button
					class="font-semibold shadow-md border border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-sm hover:bg-gray-50"
					onclick={() => fileInput?.click()}
				>
					<i class="fa-solid fa-folder-open mr-2"></i>Datei auswählen
				</button>

				<button
					class="font-semibold shadow-md border border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-sm hover:bg-gray-50"
					onclick={() => (showUrlInput = !showUrlInput)}
				>
					<i class="fa-solid fa-link mr-2"></i>URL laden
				</button>

				<button
					class="font-semibold shadow-md border border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-sm hover:bg-gray-50"
					onclick={handleCameraCapture}
				>
					<i class="fa-solid fa-camera mr-2"></i>Kamera
				</button>
			</div>

			{#if showUrlInput}
				<div class="mt-4 flex gap-2">
					<input
						type="text"
						bind:value={urlInput}
						placeholder="https://example.com/image.jpg"
						class="flex-1 px-3 py-2 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<button
						class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600"
						onclick={handleUrlLoad}
					>
						Laden
					</button>
				</div>
			{/if}
		</div>

		<input type="file" bind:this={fileInput} onchange={handleFileSelect} accept="image/*" hidden />

		<input
			type="file"
			bind:this={cameraInput}
			onchange={handleFileSelect}
			accept="image/*"
			capture="environment"
			hidden
		/>
	</div>
{/if}
