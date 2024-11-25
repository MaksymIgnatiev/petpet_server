fileNotForRunning()

import { join } from "path"
import sharp from "sharp"
import { GifCodec, GifFrame, GifUtil, BitmapImage } from "gifwrap"

import type { PetPetParams } from "./types"
import { fileNotForRunning, green } from "./functions"
import { ROOT_PATH } from "./config"

var sharpBlankImageOpts = { r: 0, g: 0, b: 0, alpha: 0 },
	gifEncodeOpts = { loops: 0, colorScope: 0 as 0 | 1 | 2 | undefined },
	finaSharplImageOpts = { palette: true, colors: 256, dither: 1 },
	handFrames: GifFrame[],
	FrameCount: number,
	handGifDimensions: { width: number; height: number },
	r = Math.round.bind(Math)

Bun.file(join(ROOT_PATH, "assets", "hand.gif"))
	.arrayBuffer()
	.then((arrBuffer) => {
		GifUtil.read(Buffer.from(arrBuffer)).then((gif) => {
			handFrames = gif.frames
			FrameCount = handFrames.length
			handGifDimensions = { width: gif.width, height: gif.height }
		})
	})

function formatObj(obj: Record<string, any>) {
	var result = []
	for (var [key, value] of Object.entries(obj)) result.push(`${green(key)}: ${value}`)
	return result.join(", ")
}

export var defaultPetPetParams: {
	+readonly [K in keyof PetPetParams]-?: PetPetParams[K]
} = {
	shiftX: 0,
	shiftY: 0,
	size: 90,
	fps: 16,
	resizeX: 0,
	resizeY: 0,
	squeeze: 10,
} as const

/** Get the progress of the GIF frame by frame providing an index of the frame
 * Each value represents a multiplyer to the `squeeze` value */
function getProgress(index: number) {
	if (index === 0) return 0.1
	else if (index === 1) return 0.5
	else if (index === 2) return 1
	else if (index === 3) return 0.9
	else if (index === 4) return 0.2
	else return 0
}

export async function generatePetPet(
	avatar: Uint8Array,
	params: PetPetParams = defaultPetPetParams,
) {
	var {
			shiftX = defaultPetPetParams.shiftX,
			shiftY = defaultPetPetParams.shiftY,
			size = defaultPetPetParams.size,
			fps = defaultPetPetParams.fps,
			resizeX = defaultPetPetParams.resizeX,
			resizeY = defaultPetPetParams.resizeY,
			squeeze = defaultPetPetParams.squeeze,
		} = params,
		/** Normalize fps for gifwrap.GifFrame
		 * 1s = 1000ms = 100cs */
		FPS = ~~(100 / fps),
		gifCodec = new GifCodec(),
		baseShift = 1,
		expansionFactor = 0.5,
		// help me. I can't create the right logic 💀
		framesPromises = Array.from({ length: FrameCount }, async (_, i) => {
			// Logic for every frame in form of promise
			var m = Math.floor(FrameCount / 2),
				progress = r(getProgress(i) * squeeze),
				needShift = i > m,
				shiftBase = needShift ? baseShift : 0,
				handOffsetY = progress,
				newWidth = r(size + resizeX + progress * expansionFactor),
				newHeight = r(size + resizeY - progress * 2),
				totalShiftX = shiftX,
				totalShiftY = shiftY + progress,
				centerX = r((handGifDimensions.width - newWidth) / 2),
				centerY = r((handGifDimensions.height - newHeight) / 2),
				handFrame = handFrames[i],
				extractTop = r(centerY < 0 ? Math.max(Math.abs(centerY) - progress, 0) : 0),
				extractLeft = r(
					Math.max(centerX < 0 ? Math.max(Math.abs(centerX) - shiftBase, 0) : 0, 0),
				),
				extractWidth = Math.min(newWidth, handGifDimensions.width),
				extractHeight = Math.min(newHeight, handGifDimensions.height)
			console.log(
				formatObj({
					newWidth,
					newHeight,
					totalShiftY,
					centerY,
					progress,
					extractTop,
					extractLeft,
					extractWidth,
					extractHeight,
				}),
			)
			return sharp(avatar)
				.resize({
					width: newWidth,
					height: newHeight,
					kernel: sharp.kernel.nearest,
					fit: "fill",
				})
				.extract({
					left: extractLeft,
					top: extractTop,
					width: extractWidth,
					height: extractHeight,
				})
				.toBuffer()
				.then((baseImage) =>
					sharp({
						create: {
							width: handGifDimensions.width,
							height: handGifDimensions.height,
							channels: 4,
							background: sharpBlankImageOpts,
						},
					})
						.composite([
							{
								input: baseImage,
								top: centerY < 0 ? 0 : centerY + totalShiftY,
								left: Math.max(centerX + shiftBase, 0) + totalShiftX,
							},
							{
								input: handFrame.bitmap.data,
								raw: {
									width: handFrame.bitmap.width,
									height: handFrame.bitmap.height,
									channels: 4,
								},
								top: handOffsetY,
								left: 0,
							},
						])
						.png(finaSharplImageOpts)
						.raw()
						.toBuffer()
						.then((combinedImage) => {
							var bitmap = new BitmapImage(
								handGifDimensions.width,
								handGifDimensions.height,
								combinedImage,
							)

							// Quantize the image to only 256 colors (GIF limitation)
							GifUtil.quantizeDekker(bitmap, 256)

							return new GifFrame(
								handGifDimensions.width,
								handGifDimensions.height,
								bitmap.bitmap.data,
								{ delayCentisecs: FPS },
							)
						}),
				)
		})

	return Promise.all(framesPromises).then((frames) =>
		gifCodec.encodeGif(frames, gifEncodeOpts).then((obj) => Uint8Array.from(obj.buffer)),
	)
}

/** Fetch the avatar from 3rd party API, and return a promise with resolving value: `Uint8Array` with PNG image, and rejecting value: `Responce` with response from API */
export function fetchAvatar(id: string, size?: number) {
	return new Promise<Uint8Array>((resolve, reject) => {
		fetch(`https://avatar.cdev.shop/${id}${size !== undefined ? `?size=${size}` : ""}`).then(
			(res) =>
				res.ok
					? res.arrayBuffer().then((data) => resolve(new Uint8Array(data)))
					: reject(res),
			reject,
		)
	})
}
