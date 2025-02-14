if (process.env.npm_config_user_agent?.includes("bun")) {
	// if it was a script - clear the line above (`$ bun run src/index.ts`)
	if (process.stdout.isTTY) process.stdout.write("\x1b[1A\x1b[2K") // 1A - move cursor one line up; 2K - clear the entire line
}

import { Hono, type Context, type TypedResponse } from "hono"
import { join } from "path"
import { Stats, unwatchFile, watchFile } from "fs"
import { stdout } from "process"
import type { Server } from "bun"

import { defaultPetPetParams } from "./petpet"
import type { PetPetParams, Hash, AlwaysResolvingPromise, ChechValidPetPetParams } from "./types"
import {
	chechCache,
	checkValidRequestParams,
	colorValue,
	enterAlternateBuffer,
	error,
	EXIT,
	getConfig,
	gray,
	green,
	info,
	isCurrentCacheType,
	isLogfeatureEnabled,
	isStringNumber,
	log,
	logger,
	print,
	verboseError,
} from "./functions"
import { cache, statControll, stats } from "./db"
import { getGlobalConfigOption, getGlobalOption, getServerOption, ROOT_PATH } from "./config"
import { processFlags } from "./flags"

var args = process.argv.slice(2),
	app = new Hono(),
	server: Server,
	watcher: undefined | (() => void),
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
		c.status(204)
		return c.json({ ok: true, code: 204, statusText: "No Content" })
	}

app.get("/favicon.ico", noContent)

app.get("/stats", (c) => c.json(stats))

app.use("/:id", async (c, next) => {
	// `logger` is the function to log the requests and responses
	if (isStringNumber(c.req.param("id"))) {
		return isLogfeatureEnabled("rest") ? logger()(c, next) : next()
	} else return next()
})

app.get("/:id", async (c) => {
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

// no content on all other routes
app.get("*", noContent)

function setupWatch() {
	// Watch the root directory for changes, and if it was a config file,
	// if `useConfig` global option is enabled,
	// then start the server with `restart: true` value for indication
	// proposes to default all values, and re-load flags and config file
	var filepath = join(ROOT_PATH, "config.toml"),
		listener = (curr: Stats, prev: Stats) => {
			if (curr.mtime.getTime() === 0) {
				// File was deleted
				if (getGlobalConfigOption("useConfig")) restart("deleted")
			} else if (prev.mtime.getTime() === 0) {
				// File was created
				if (getGlobalConfigOption("useConfig")) restart("created")
			} else if (curr.mtime > prev.mtime) {
				// File was modified
				if (getGlobalConfigOption("useConfig")) restart("changed")
			}
		}
	watchFile(filepath, { interval: 1000 }, listener).on("error", (e) => {
		verboseError(
			e,
			error("Error while watching config files for change:\n"),
			error("Error while watching config files for change"),
		)
	})
	return () => unwatchFile(filepath, listener)
}

function handleCacheInterval() {
	if (intervalID) clearInterval(intervalID)
	if (getGlobalOption("cache") && !getGlobalOption("permanentCache"))
		intervalID = setInterval(chechCache, getGlobalOption("cacheCheckTime"))
}

function handleWatcher() {
	if (watcher) {
		watcher()
		watcher = undefined
	}
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
	return main(true, false).then((text) => {
		if (getGlobalOption("clearOnRestart")) stdout.write("\x1b[2J\x1b[H")
		if (text) log("info", text)
		log("watch", info(`Server restarted due to changes in config file: ${green(eventType)}`))
		listening()
	})
}

/** Process flags (if exist), try to get and parse the config file, and after init all other things based on the result */
function main(reload?: boolean, log?: boolean): AlwaysResolvingPromise<string>
function main(r = false, l = true): AlwaysResolvingPromise<string> {
	var printText = ""
	// Do not process anything if there are no flags => less CPU & RAM usage and faster startup time :)
	if (args.length) printText = processFlags(args)
	return getConfig(r)
		.then(processAfterConfig)
		.then(() => {
			if (printText) log("info", printText)
			// logGlobalOptions()
			if (l) listening()
		})
		.then(() => printText) as AlwaysResolvingPromise<string>
}

main()
