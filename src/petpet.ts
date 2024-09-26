import type { User as PetPet, PetPetParams } from "./types"
import path from "path"
import sharp from "sharp"
import { GifCodec, GifFrame, GifUtil, BitmapImage } from "gifwrap"
import { updatePetPet } from "./functions"

var handGIFBuffer = Buffer.from(
		await Bun.file(
			path.join(__dirname, "../assets/hand.gif"),
		).arrayBuffer(),
	),
	sharpBlankImageOpts = { r: 0, g: 0, b: 0, alpha: 0 },
	handGif = await GifUtil.read(handGIFBuffer),
	handFrames = handGif.frames.filter((_, i) => !(i % 2)),
	handGifDimensions = {
		width: handGif.width,
		height: handGif.height,
	}

export async function generatePetPet(
	petpet: PetPet,
	params: PetPetParams = {},
) {
	var {
		shiftX = 0,
		shiftY = 0,
		size = 90,
		fps = 16,
		resizeX = 0,
		resizeY = 0,
		squeeze = 10,
	} = params
	console.time("Fetching avatar")
	var avatar = await fetchAvatar(petpet.id)
	console.timeEnd("Fetching avatar")

	// console.log("Params for gif:", {
	// size,
	// fps,
	// shiftX,
	// shiftY,
	// resizeX,
	// resizeY,
	// })

	fps = ~~(100 / fps)

	if (!(avatar instanceof Buffer)) return avatar

	var gifCodec = new GifCodec(),
		frames: GifFrame[] = [],
		baseShift = 1,
		expansionFactor = 0.5

	for (var i = 0, l = handFrames.length, m = Math.floor(l / 2); i < l; i++) {
		var progress = Math.round((1 - Math.abs(i - m) / m) * squeeze),
			needShift = i > m,
			shiftBase = needShift ? baseShift : 0,
			handOffsetY = progress,
			newWidth = Math.round(
				size + resizeX / 2 + progress * expansionFactor,
			),
			newHeight = Math.round(size + resizeY / 2 - progress * 2),
			totalShiftX = shiftX,
			totalShiftY = shiftY + progress,
			centerX = Math.round((handGifDimensions.width - newWidth) / 2),
			centerY = Math.round((handGifDimensions.height - newHeight) / 2),
			handFrame = handFrames[i],
			baseImage = await sharp(avatar)
				.resize({
					width: newWidth,
					height: newHeight,
					kernel: sharp.kernel.nearest,
					fit: "fill",
				})
				.extract({
					left:
						centerX < 0
							? Math.max(Math.abs(centerX) - shiftBase, 0)
							: 0,
					top: centerY < 0 ? Math.abs(centerY) - progress : 0,
					width: Math.min(newWidth, handGifDimensions.width),
					height: Math.min(newHeight, handGifDimensions.height),
				})
				.toBuffer(),
			combinedImage = await sharp({
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
						top: Math.max(centerY, 0) + totalShiftY,
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
				.png({ palette: true, colors: 256, dither: 1 })
				.raw()
				.toBuffer(),
			bitmap = new BitmapImage(
				handGifDimensions.width,
				handGifDimensions.height,
				combinedImage,
			)

		GifUtil.quantizeDekker(bitmap, 256)

		frames.push(
			new GifFrame(
				handGifDimensions.width,
				handGifDimensions.height,
				bitmap.bitmap.data,
				{ delayCentisecs: fps },
			),
		)
	}
	var gifBuffer = (
		await gifCodec.encodeGif(frames, { loops: 0, colorScope: 0 })
	).buffer

	petpet.gif = gifBuffer
	petpet.hasImage = true
	updatePetPet(petpet)

	return gifBuffer
}

export async function fetchAvatar(id: string) {
	var response = await fetch(`https://avatar.cdev.shop/${id}`)
	if (!response.ok) return response
	return Buffer.from(await response.arrayBuffer())
}
