fileNotForRunning()

import { join } from "path"
import sharp from "sharp"
import { GifCodec, GifFrame, GifUtil, BitmapImage } from "gifwrap"

import type { Join, PetPetParams, Values } from "./types"
import { fileNotForRunning, formatObject } from "./functions"
import { ROOT_PATH } from "./config"

type ObjectsType = ["hand", "avatar"]

var sharpBlankImageOpts = { r: 0, g: 0, b: 0, alpha: 0 },
	gifEncodeOpts = { loops: 0, colorScope: 0 as 0 | 1 | 2 | undefined },
	finaSharplImageOpts = { palette: true, colors: 256, dither: 1 },
	handFrames: GifFrame[],
	FrameCount: number,
	handGifDimensions: { width: number; height: number },
	r = Math.round.bind(Math)

export var defaultPetPetParams: { +readonly [K in keyof PetPetParams]: PetPetParams[K] } = {
		shiftX: 0,
		shiftY: 0,
		size: 100,
		gifsize: 128,
		fps: 16,
		resizeX: 0,
		resizeY: 0,
		squeeze: 12,
		objects: "both",
	} as const,
	objectsTypes: ObjectsType = ["hand", "avatar"],
	objectsTypesJoined = objectsTypes.join("|") as Join<ObjectsType, "|">

Bun.file(join(ROOT_PATH, "assets", "petpet_template_modified.gif"))
	.arrayBuffer()
	.then((arrBuffer) => {
		GifUtil.read(Buffer.from(arrBuffer)).then((gif) => {
			handFrames = gif.frames
			FrameCount = handFrames.length
			handGifDimensions = { width: gif.width, height: gif.height }
		})
	})

function haveObject(current: PetPetParams["objects"], obj: Values<typeof objectsTypes>) {
	return current === "both" || current === obj
}

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
	params: Partial<PetPetParams> = defaultPetPetParams,
) {
	var {
			shiftX = defaultPetPetParams.shiftX,
			shiftY = defaultPetPetParams.shiftY,
			size = defaultPetPetParams.size,
			gifsize = defaultPetPetParams.gifsize,
			fps = defaultPetPetParams.fps,
			resizeX = defaultPetPetParams.resizeX,
			resizeY = defaultPetPetParams.resizeY,
			squeeze = defaultPetPetParams.squeeze,
			objects = defaultPetPetParams.objects,
		} = params,
		/** Normalized fps for gifwrap.GifFrame
		 * 1s = 1000ms = 100cs */
		FPS = ~~(100 / fps),
		gifCodec = new GifCodec(),
		/** Shift the base image by `x` pixels in the other half of image */
		baseShift = 1,
		expansionFactor = 0.5,
		scaleFactor = gifsize / defaultPetPetParams.gifsize,
		framesPromises = Array.from({ length: FrameCount }, async (_, i) => {
			var m = Math.floor(FrameCount / 2),
				progress = r(getProgress(i) * squeeze * Math.tanh(scaleFactor) ** 0.4),
				needShift = i > m,
				shiftBase = needShift ? r(baseShift * scaleFactor) : 0,
				handOffsetY = r(progress * Math.tanh(scaleFactor)),
				newWidth = r((size + resizeX + progress * expansionFactor) * scaleFactor),
				newHeight = r((size + resizeY - progress) * scaleFactor),
				totalShiftX = r(shiftX * scaleFactor),
				totalShiftY = r((shiftY + progress) * scaleFactor),
				centerX = r((gifsize - newWidth) / 2),
				centerY = r((gifsize - newHeight) / 2),
				handFrame = handFrames[i]
			console.log(
				formatObject({
					size,
					resizeY,
					progress,
					scaleFactor,
					newHeight,
					totalShiftY,
					centerY,
				}),
			)
			return Promise.all([
				new Promise<Buffer>((resolve) => {
					haveObject(objects, "avatar")
						? resolve(
								sharp(avatar)
									.resize({
										width: newWidth,
										height: newHeight,
										kernel: sharp.kernel.lanczos2,
										fit: "fill",
									})
									.extract({
										top: centerY < 0 ? Math.abs(centerY) : 0,
										left: centerX < 0 ? Math.abs(centerX) : 0,
										width: newWidth > gifsize ? gifsize : newWidth,
										height: newHeight > gifsize ? gifsize : newHeight,
									})
									.toBuffer(),
							)
						: resolve(Buffer.alloc(0))
				}),
				new Promise<Buffer>((resolve) => {
					haveObject(objects, "hand")
						? resolve(
								sharp(handFrame.bitmap.data, {
									raw: {
										width: handFrame.bitmap.width,
										height: handFrame.bitmap.height,
										channels: 4,
									},
								})
									.resize({
										width: gifsize,
										height: gifsize,
										kernel: sharp.kernel.lanczos2,
										fit: "fill",
									})
									.raw()
									.toBuffer(),
							)
						: resolve(Buffer.alloc(0))
				}),
			]).then(([resizedAvatar, resizedHand]) =>
				sharp({
					create: {
						width: gifsize,
						height: gifsize,
						channels: 4,
						background: sharpBlankImageOpts,
					},
				})
					.composite(
						(() => {
							var objs: sharp.OverlayOptions[] = []
							if (haveObject(objects, "avatar"))
								objs.push({
									input: resizedAvatar,
									top: (centerY < 1 ? 0 : centerY) + totalShiftY,
									left: Math.max(centerX + shiftBase, 0) + totalShiftX,
								})
							if (haveObject(objects, "hand"))
								objs.push({
									input: resizedHand,
									raw: {
										width: gifsize,
										height: gifsize,
										channels: 4 as const,
									},
									top: handOffsetY,
									left: 0,
								})

							return objs
						})(),
					)
					.png(finaSharplImageOpts)
					.raw()
					.toBuffer()
					.then((combinedImage) => {
						var bitmap = new BitmapImage(gifsize, gifsize, combinedImage)

						GifUtil.quantizeDekker(bitmap, 256)

						return new GifFrame(gifsize, gifsize, bitmap.bitmap.data, {
							delayCentisecs: FPS,
						})
					}),
			)
		})

	return Promise.all(framesPromises).then((frames) =>
		gifCodec.encodeGif(frames, gifEncodeOpts).then((obj) => Uint8Array.from(obj.buffer)),
	)
}
