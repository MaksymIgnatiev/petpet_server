if (process.argv[1].match(/petpet(.ts)?$/))
	console.log(
		error(
			`File ${green("@/src/petpet.ts")} is a library file and is not intended to be run directly`,
		),
	),
		process.exit()

import type { PetPetParams } from "./types"
import path from "path"
import sharp from "sharp"
import { GifCodec, GifFrame, GifUtil, BitmapImage } from "gifwrap"
import { error, green } from "./functions"

var handGIFBuffer = Buffer.from(
		await Bun.file(
			path.join(__dirname, "../assets/hand.gif"),
		).arrayBuffer(),
	),
	sharpBlankImageOpts = { r: 0, g: 0, b: 0, alpha: 0 },
	gifEncodeOpts = { loops: 0, colorScope: 0 as 0 | 1 | 2 | undefined },
	finaSharplImageOpts = { palette: true, colors: 256, dither: 1 },
	handGif = await GifUtil.read(handGIFBuffer),
	handFrames = handGif.frames.filter((_, i) => !(i % 2)),
	FrameCount = handFrames.length,
	handGifDimensions = {
		width: handGif.width,
		height: handGif.height,
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
}

export async function generatePetPet(
	avatar: Buffer,
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
		gifCodec = new GifCodec(),
		frames: GifFrame[] = [],
		baseShift = 1,
		expansionFactor = 0.5

	// Normalize fps for gifwrap.GifFrame
	// 1s = 1000ms = 100cs
	fps = ~~(100 / fps)

	for (var i = 0, m = Math.floor(FrameCount / 2); i < FrameCount; i++) {
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
				.png(finaSharplImageOpts)
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

	return new Promise<Buffer>((resolve) =>
		gifCodec
			.encodeGif(frames, gifEncodeOpts)
			.then((obj) => resolve(obj.buffer)),
	)
}

export async function fetchAvatar(id: string) {
	return new Promise<Buffer | Response>((r) => {
		fetch(`https://avatar.cdev.shop/${id}`).then((res) =>
			res.ok
				? res.arrayBuffer().then((data) => r(Buffer.from(data)))
				: r(res),
		)
	})
}
