stdout.write("\x1b[1A\x1b[2K")

import { stdout } from "process"
import fs from "fs"
import { Hono, type Context, type TypedResponse } from "hono"
import type { Server } from "bun"

import { defaultPetPetParams } from "./petpet"
import type { PetPetParams, Hash } from "./types"
import {
	chechCache,
	checkValidRequestParams,
	enterAlternateBuffer,
	error,
	EXIT,
	getConfig,
	green,
	hasConfigFile,
	info,
	isCurrentCacheType,
	isLogfeatureEnabled,
	isStringNumber,
	log,
	logger,
	memoize,
	verboseError,
} from "./functions"
import {
	getGlobalConfigOption,
	getGlobalOption,
	getServerOption,
	ROOT_PATH,
	setGlobalConfigOption,
} from "./config"
import { processFlags } from "./flags"
import { cache, statControll, stats } from "./db"

var args = process.argv.slice(2),
	app = new Hono(),
	server: Server,
	watcher: fs.FSWatcher,
	intervalID: Timer,
	/** Exit function from the alternate buffer
	 * `undefined` - not in alternate buffer
	 * `function` - in alternate buffer */
	exitAlternate: undefined | (() => void),
	/** Exit the whole process with exiting alternate buffer
	 *
	 * DON'T TRY TO USE THIS FUNCTION UNLESS YOU KNOW WHAT YOU ARE DOING
	 *
	 * Basicaly, it's just a function that force exits the alternate buffer, and exit the process, so, nothing special */
	exit: undefined | (() => void),
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
	},
	noContent = (c: Context) => {
		// do not ask again for 30 days
		c.header("Cache-Control", `public, max-age=${cacheTime}`)
		return c.json({ ok: true, code: 204, statusText: "No Content" }, 204)
	}

app.get("/favicon.ico", noContent)

app.get("/stats", (c) => c.json(stats))

app.use("/:id", async (c, next) => {
	// `logger` is the function to log the requests and responses
	if (isStringNumber(c.req.param("id")))
		return isLogfeatureEnabled("rest") ? logger()(c, next) : next()
	else return next()
})

app.get("/:id", async (c) => {
	var userID = c.req.param("id"),
		shiftRaw = c.req.query("shift"),
		update = !!c.req.url.match(/[?&]upd(&|=|$)/),
		sizeRaw = c.req.query("size"),
		resizeRaw = c.req.query("resize"),
		fpsRaw = c.req.query("fps"),
		squeezeRaw = c.req.query("squeeze"),
		shiftX = defaultPetPetParams.shiftX,
		shiftY = defaultPetPetParams.shiftY,
		size = defaultPetPetParams.size,
		fps = defaultPetPetParams.fps,
		resizeX = defaultPetPetParams.resizeX,
		resizeY = defaultPetPetParams.resizeY,
		squeeze = defaultPetPetParams.squeeze

	if (!isStringNumber(userID)) return noContent(c)

	var notValidParams = checkValidRequestParams(c, {
		shift: shiftRaw,
		size: sizeRaw,
		resize: resizeRaw,
		fps: fpsRaw,
		squeeze: squeezeRaw,
	})

	// console.log("Request params: ", { userID, shift, size, resize, fps })
	if (notValidParams) {
		statControll.response.common.increment.failure()
		return notValidParams
	}

	// at this point, each parameter is checked with `checkValidRequestParams` function, and can be used if it's exist
	if (shiftRaw !== undefined) [shiftX, shiftY] = shiftRaw.split("x").map(Number)
	if (resizeRaw !== undefined) [resizeX, resizeY] = resizeRaw.split("x").map(Number)
	if (sizeRaw !== undefined) size = +sizeRaw
	if (fpsRaw !== undefined) fps = +fpsRaw
	if (squeezeRaw !== undefined) squeeze = +squeezeRaw

	var petpetHash: Hash = `${userID}-${shiftX}x${shiftY}-${resizeX}x${resizeY}-${size}-${fps}-${squeeze}`,
		petpetParams: PetPetParams = { shiftX, shiftY, size, fps, resizeX, resizeY, squeeze }

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

			console.log("Gif:")
			if (isCurrentCacheType("code")) {
				if (cache.gif.code.has(petpetHash)) {
					console.log(green("gif in code cache"))
					ready(cache.gif.code.get(petpetHash)!.gif)
					resolved ||= true
				}
			}
			if (isCurrentCacheType("fs")) {
				if (!resolved && cache.gif.fs.has(petpetHash)) {
					console.log(green("gif in fs cache"))
					cache.gif.fs
						.get(petpetHash)
						.then((gif) => (gif instanceof Uint8Array ? ready(gif) : void 0))
					resolved ||= true
				}
			}

			if (!resolved && cache.gif.queue.has(petpetHash)) {
				console.log(green("gif in queue"))
				addCallback(ready)
				promise.resolve(cache.gif.queue.get(petpetHash))
				resolved ||= true
			}
			if (isCurrentCacheType("code")) {
				if (!resolved && cache.avatar.code.has(userID)) {
					console.log(green("avatar in code cache"))
					addCallback((png) =>
						cache.gif.queue.add(petpetHash, png, petpetParams).then(ready),
					)
					promise.resolve(cache.avatar.code.get(userID)!.avatar)
					resolved ||= true
				}
			}
			if (isCurrentCacheType("fs")) {
				if (!resolved && cache.avatar.fs.has(userID)) {
					console.log(green("avatar in fs cache"))
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
			if (!resolved && cache.avatar.queue.has(userID)) {
				console.log(green("avatar in queue"))
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
				console.log(green("feting avatar"))
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
	// `logger` is the function to log the requests and responses
	if (isStringNumber(c.req.param("id")))
		return isLogfeatureEnabled("rest") ? logger()(c, next) : next()
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
				console.log("Avatar:")
				if (isCurrentCacheType("code")) {
					if (!resolved && cache.avatar.code.has(id)) {
						console.log(green("avatar in code cache"))
						ready(cache.avatar.code.get(id)!.avatar)
						resolved ||= true
					}
				}
				if (isCurrentCacheType("fs")) {
					if (!resolved && cache.avatar.fs.has(id)) {
						console.log(green("avatar in fs cache"))
						cache.avatar.fs
							.get(id)!
							.then((avatar) =>
								avatar instanceof Uint8Array ? ready(avatar) : void 0,
							)
						resolved ||= true
					}
				}
				if (!resolved && cache.avatar.queue.has(id)) {
					console.log(green("avatar in queue"))
					cache.avatar.queue.get(id)!.then(ready, (response) => {
						statControll.response.common.increment.failure()
						resolve(response)
					})
					resolved ||= true
				} else if (!resolved) {
					console.log(green("feting avatar"))
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

// no content on all other routes
app.get("*", noContent)

function setupWatch() {
	// Watch the root directory for changes, and if it was a config file,
	// if `useConfig` global option is enabled,
	// then start the server with `restart: true` value for indication
	// proposes to default all values, and re-load flags and config file
	return fs
		.watch(ROOT_PATH, { persistent: true }, (event, file) => {
			console.log(green(event))
			if (getGlobalConfigOption("useConfig") && /^config\.toml~?$/.test(file ?? "")) {
				var eventType = "changed" as Parameters<typeof restart>[0],
					hasConfig = memoize(hasConfigFile)
				if (getGlobalConfigOption("config")) {
					if (hasConfig.value) {
						eventType = "changed"
					} else {
						eventType = "deleted"
						setGlobalConfigOption("config", false)
					}
				} else if (hasConfig.value) {
					eventType = "created"
					setGlobalConfigOption("config", true)
				}

				restart(eventType)
			}
		})
		.on("error", (e) => {
			verboseError(
				e,
				error("Error while watching config files for change:\n"),
				error("Error while watching config files for change"),
			)
		})
}

function handleCacheInterval() {
	if (intervalID) clearInterval(intervalID)
	if (getGlobalOption("cache") && !getGlobalOption("permanentCache"))
		intervalID = setInterval(chechCache, getGlobalOption("cacheCheckTime"))
}

function handleWatcher() {
	if (watcher) watcher?.close?.()
	if (getGlobalOption("watch")) {
		watcher = setupWatch()
	}
}

function handleServer() {
	if (server) server?.stop?.()
	server = Bun.serve({
		fetch: app.fetch,
		idleTimeout: 60,
		port: getServerOption("port"),
		hostname: getServerOption("host"),
	})
}

/** Dynamicaly enter and exit alternate buffer depending on config preferences, and handle `SIGINT` / `SIGTERM` signals to exit alternate buffer */
function handleAlternateBuffer() {
	if (getGlobalOption("alternateBuffer")) {
		if (!exitAlternate) {
			exitAlternate = enterAlternateBuffer()
			exit = () => {
				if (exitAlternate) exitAlternate()
				EXIT()
			}
			process.on("SIGINT", exit)
			process.on("SIGTERM", exit)
		}
	} else {
		console.log("not in alternate")
		if (exitAlternate) {
			exitAlternate()
			process.removeListener("SIGINT", exit!)
			process.removeListener("SIGTERM", exit!)
			exitAlternate = undefined
		}
	}
}

function listening() {
	log(
		"info",
		info(server?.url ? `Listening on URL: ${green(server.url)}` : "Server is not yet started"),
	)
}

/** Process server setup after geting the config */
function processAfterConfig() {
	handleAlternateBuffer()
	handleCacheInterval()
	handleServer()
	handleWatcher()
}

async function restart(eventType: "created" | "changed" | "deleted") {
	return main(true, false).then(() => {
		if (getGlobalOption("clearOnRestart")) stdout.write("\x1b[2J\x1b[H")
		console.log(`Alternate buffer: ${green(getGlobalOption("alternateBuffer"))}`)
		log("info", info(`Server restarted due to changes in config file: ${green(eventType)}`))
		listening()
	})
}
async function main(reload = false, log = true) {
	// Do not process anything if there are no flags => less CPU & RAM usage and faster startup time :)
	args.length && processFlags(args)
	return getConfig(reload)
		.then(processAfterConfig)
		.then(() => (log ? listening() : void 0))
}

main()
