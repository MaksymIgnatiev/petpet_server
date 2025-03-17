import { join } from "path"
import { Hono, type Context, type TypedResponse } from "hono"
import {
	APILogger,
	checkValidRequestParams,
	colorValue,
	error,
	info,
	log,
	gray,
	green,
	isCurrentCacheType,
	isLogfeatureEnabled,
	isStringNumber,
	print,
	verboseError,
} from "./functions"
import { cache, statControll, stats } from "./db"
import { defaultPetPetParams } from "./petpet"
import type { ChechValidPetPetParams, Hash, ImageResponse, PetPetParams } from "./types"
import { cors } from "hono/cors"
import { serveStatic } from "hono/bun"
import { getGlobalOption, ROOT_PATH } from "./config"
import { existsSync, readdirSync } from "fs"
import "./wss"

var app = new Hono(),
	noContent = (c: Context) => {
		// do not ask again for 30 days
		c.header("Cache-Control", `public, max-age=${cacheTime}`)
		c.status(204)
		return c.json({ ok: true, code: 204, statusText: "No Content" })
	},
	// 30d do not ask again via cache in HTTP headers
	cacheTime = 30 * 24 * 60 * 60,
	GIFResponse = (gif: Uint8Array) =>
		new Response(gif, {
			status: 200,
			statusText: "OK",
			headers: { "Content-Type": "image/gif" },
		}),
	PNGResponse = (avatar: Uint8Array) =>
		new Response(avatar, {
			status: 200,
			statusText: "OK",
			headers: { "Content-Type": "image/png" },
		}),
	internalServerError = (c: Context, route: "/avatar/:id" | "/:id") => {
		statControll.response[route === "/avatar/:id" ? "avatars" : "common"].increment.failure()
		return c.json(
			{
				ok: false as const,
				code: 500 as const,
				statusText: "Internal Server Error" as const,
				message: "Something went wrong while processing the request" as const,
			},
			500 as const,
		)
	}

app.use("*", cors({ origin: "*" }))

app.use(
	"/_app/*",
	serveStatic({
		root: "./svelte-app/build",
		rewriteRequestPath: (path) => path.replace(/^\/_app/, "_app"),
	}),
)

app.get("/favicon.ico", noContent)

app.get("/stats", (c) => c.json(stats))

app.use("/:id", async (c, next) => {
	// `APILogger` is the function to log the requests and responses
	if (isStringNumber(c.req.param("id"))) {
		return isLogfeatureEnabled("rest") ? APILogger()(c, next) : next()
	} else return next()
})

app.get("/:id", async (c) => {
	return c.json({ message: "Not yet fully implemented!" })
	var userID = c.req.param("id"),
		update = !!c.req.url.match(/[?&]upd(&|=|$)/),
		shiftRaw = c.req.query("shift"),
		sizeRaw = c.req.query("size"),
		gifsizeRaw = c.req.query("gifsize"),
		resizeRaw = c.req.query("resize"),
		fpsRaw = c.req.query("fps"),
		squeezeRaw = c.req.query("squeeze"),
		objectsRaw = c.req.query("objects"),
		shiftX = defaultPetPetParams.shiftX,
		shiftY = defaultPetPetParams.shiftY,
		size = defaultPetPetParams.size,
		gifsize = defaultPetPetParams.gifsize,
		fps = defaultPetPetParams.fps,
		resizeX = defaultPetPetParams.resizeX,
		resizeY = defaultPetPetParams.resizeY,
		squeeze = defaultPetPetParams.squeeze,
		objects = defaultPetPetParams.objects

	if (!isStringNumber(userID)) return noContent(c)

	var params: ChechValidPetPetParams = {
			shift: shiftRaw,
			size: sizeRaw,
			gifsize: gifsizeRaw,
			resize: resizeRaw,
			fps: fpsRaw,
			squeeze: squeezeRaw,
			objects: objectsRaw,
		},
		notValidParams = checkValidRequestParams(c, params)

	if (notValidParams) {
		statControll.response.common.increment.failure()
		return notValidParams
	}

	if (isLogfeatureEnabled("params")) {
		var requestParams: string[] = []
		for (var [paramKey, paramValue] of Object.entries(params)) {
			if (paramValue !== undefined) {
				requestParams.push(`${gray(paramKey)}: ${colorValue(paramValue)}`)
			}
		}
		print(`${"Request params:"} ${requestParams.join(`${gray(",")} `)}`)
	}

	// at this point, each parameter is checked with `checkValidRequestParams` function, and can be used if it's exist
	if (shiftRaw !== undefined) [shiftX, shiftY] = shiftRaw.split("x").map(Number)
	if (resizeRaw !== undefined) [resizeX, resizeY] = resizeRaw.split("x").map(Number)
	if (sizeRaw !== undefined) size = +sizeRaw
	if (gifsizeRaw !== undefined) gifsize = +gifsizeRaw
	if (fpsRaw !== undefined) fps = +fpsRaw
	if (squeezeRaw !== undefined) squeeze = +squeezeRaw
	if (objectsRaw !== undefined)
		objects = objectsRaw.includes(",") ? "both" : (objectsRaw as typeof objects)
	else objects = "both"

	var petpetHash: Hash = `${userID}-${shiftX}x${shiftY}-${resizeX}x${resizeY}-${squeeze}-${size}-${gifsize}-${fps}-${objects}`,
		petpetParams: Partial<PetPetParams> = {
			shiftX,
			shiftY,
			size,
			fps,
			resizeX,
			resizeY,
			squeeze,
			gifsize,
			objects,
		}

	try {
		return new Promise<Response>((resolve) => {
			// 3 essentials that will do whole work automaticaly thanks to the `thenableObject`s
			var resolved = false,
				ready = (uintArr: Uint8Array) => {
					statControll.response.common.increment.success()
					resolve(GIFResponse(uintArr))
				},
				promise = Promise.withResolvers<Uint8Array>(),
				addCallback = (
					fn: (
						buffer: Uint8Array,
					) =>
						| void
						| PromiseLike<void>
						| Uint8Array
						| PromiseLike<Uint8Array>
						| PromiseLike<void | Uint8Array>,
				) => promise.promise.then(fn)

			print("Gif:")
			if (!update && isCurrentCacheType("code")) {
				if (cache.gif.code.has(petpetHash)) {
					print(green("gif in code cache"))
					ready(cache.gif.code.get(petpetHash)!.gif)
					resolved ||= true
				}
			}
			if (!update && isCurrentCacheType("fs")) {
				if ((!resolved || isCurrentCacheType("both")) && cache.gif.fs.has(petpetHash)) {
					print(green("gif in fs cache"))
					cache.gif.fs
						.get(petpetHash)
						.then((gif) => (gif instanceof Uint8Array ? ready(gif) : void 0))
					resolved ||= true
				}
			}

			if (!update && !resolved && cache.gif.queue.has(petpetHash)) {
				print(green("gif in queue"))
				addCallback(ready)
				promise.resolve(cache.gif.queue.get(petpetHash))
				resolved ||= true
			}
			if (!update && isCurrentCacheType("code")) {
				if (!resolved && cache.avatar.code.has(userID)) {
					print(green("avatar in code cache"))
					addCallback((png) =>
						cache.gif.queue.add(petpetHash, png, petpetParams).then(ready),
					)
					promise.resolve(cache.avatar.code.get(userID)!.avatar)
					resolved ||= true
				}
			}
			if (!update && isCurrentCacheType("fs")) {
				if ((!resolved || isCurrentCacheType("both")) && cache.avatar.fs.has(userID)) {
					print(green("avatar in fs cache"))
					addCallback((png) =>
						cache.gif.queue.add(petpetHash, png, petpetParams).then(ready),
					)
					cache.avatar.fs
						.get(userID)!
						.then((avatar) =>
							avatar instanceof Uint8Array ? promise.resolve(avatar) : void 0,
						)
					resolved ||= true
				}
			}
			if (!update && !resolved && cache.avatar.queue.has(userID)) {
				print(green("avatar in queue"))
				addCallback((png) => cache.gif.queue.add(petpetHash, png, petpetParams).then(ready))
				cache.avatar.queue.get(userID)!.then(
					(png) => promise.resolve(png),
					(response) => {
						statControll.response.common.increment.failure()
						resolve(response)
					},
				)
				resolved ||= true
			} else if (!resolved) {
				print(green("feting avatar"))
				addCallback(ready)
				cache.gif.queue.addWithAvatar(petpetHash, petpetParams).then(
					(gif) => promise.resolve(gif),
					(response) => {
						statControll.response.common.increment.failure()
						resolve(response)
					},
				)
				resolved ||= true
			}
		})
	} catch (e) {
		if (e instanceof Error)
			verboseError(
				e,
				error(`Error while processing GET /${userID} :\n`),
				error(`Error while processing GET /${userID}`),
			)
		return internalServerError(c, "/:id")
	}
})

app.use("/avatar/:id", async (c, next) => {
	// `APILogger` is the function to log the requests and responses
	if (isStringNumber(c.req.param("id")))
		return isLogfeatureEnabled("rest") ? APILogger()(c, next) : next()
	else return next()
})

app.get("/avatar/:id", async (c) => {
	var id = c.req.param("id"),
		size = c.req.query("size")
	if (!isStringNumber(id)) return noContent(c)
	if (size && !/^\d+$/.test(size)) {
		statControll.response.avatars.increment.failure()
		return c.json(
			{
				ok: false,
				code: 400,
				message:
					"Invalid size parameter. Size must contain only digits from 0 to 9 and be positive",
				statusText: "Bad Request",
			},
			400,
		)
	} else {
		try {
			return new Promise<Response | TypedResponse>((resolve) => {
				var resolved = false,
					ready = (uintArr: Uint8Array) => {
						statControll.response.common.increment.success()
						resolve(PNGResponse(uintArr))
					},
					promise = Promise.withResolvers<Uint8Array>(),
					addCallback = (
						fn: (
							buffer: Uint8Array,
						) =>
							| void
							| PromiseLike<void>
							| Uint8Array
							| PromiseLike<Uint8Array>
							| PromiseLike<void | Uint8Array>,
					) => promise.promise.then(fn)
				print("Avatar:")
				if (isCurrentCacheType("code")) {
					if (!resolved && cache.avatar.code.has(id)) {
						print(green("avatar in code cache"))
						ready(cache.avatar.code.get(id)!.avatar)
						resolved ||= true
					}
				}
				if (isCurrentCacheType("fs")) {
					if (!resolved && cache.avatar.fs.has(id)) {
						print(green("avatar in fs cache"))
						cache.avatar.fs
							.get(id)!
							.then((avatar) =>
								avatar instanceof Uint8Array ? ready(avatar) : void 0,
							)
						resolved ||= true
					}
				}
				if (!resolved && cache.avatar.queue.has(id)) {
					print(green("avatar in queue"))
					cache.avatar.queue.get(id)!.then(ready, (response) => {
						statControll.response.common.increment.failure()
						resolve(response)
					})
					resolved ||= true
				} else if (!resolved) {
					print(green("feting avatar"))
					addCallback(ready)
					cache.avatar.queue.add(id).then(
						(gif) => promise.resolve(gif),
						(response) => {
							statControll.response.common.increment.failure()
							resolve(response)
						},
					)
					resolved ||= true
				}
			})
		} catch (e) {
			if (e instanceof Error)
				verboseError(
					e,
					error(`Error while processing GET /avatar/${id} :\n`),
					error(`Error while processing GET /avatar/${id}`),
				)
			return internalServerError(c, "/avatar/:id")
		}
	}
})

app.use(
	"/",
	serveStatic({
		root: "./svelte-app/build",
	}),
)

app.get("/", () => {
	console.log(info(`/ is requested`))
	return new Response(Bun.file("./svelte-app/build/index.html"), {
		headers: { "Content-Type": "text/html" },
	})
})

// API endpoint to list images in `.cache/`
app.get("/api/images", (c): TypedResponse<ImageResponse> => {
	console.log(info(`/api/images is requested`))
	var type = c.req.query("type")
	if (!type || !/^(?:avatars|petpets|all)$/.test(type)) type = "all"
	var cacheDirs = [
			join(ROOT_PATH, ".cache"),
			join(ROOT_PATH, ".cache", "gifs"),
			join(ROOT_PATH, ".cache", "avatars"),
		] as const,
		dirsExists = cacheDirs.map(existsSync),
		imageFiles: string[] = []

	if (!dirsExists[0]) c.json({ state: "no-content" })

	if (/all|petpets/.test(type)) {
		if (dirsExists[1])
			imageFiles.push(...readdirSync(cacheDirs[1]).map((file) => `/cache/gifs/${file}`))
	}
	if (/all|avatars/.test(type)) {
		if (dirsExists[2])
			imageFiles.push(...readdirSync(cacheDirs[2]).map((file) => `/cache/avatars/${file}`))
	}

	if (!imageFiles.length)
		return c.json({ state: getGlobalOption("cache") ? "no-content" : "cache-disabled" })

	return c.json({ state: "completed", value: imageFiles })
})

app.get("/cache/:type/:id", async (c) => {
	var type = c.req.param("type")

	if (!type || !/^(?:avatars|gifs)$/.test(type)) type = "avatar"
	var id = c.req.param("id")
	var filePath = join(ROOT_PATH, ".cache", type, id)
	return Bun.file(filePath)
		.arrayBuffer()
		.then(
			(arrbuf) =>
				new Response(arrbuf, {
					headers: {
						"Content-type": `image/${id.match(/(?<=\.)\w+$/)?.[0] ?? "png"}`,
					},
				}),
		)
})

// no content on all other routes
app.get("*", noContent)

export default app
