import fs from "fs"
import { Hono } from "hono"
import { defaultPetPetParams, fetchAvatar, generatePetPet } from "./petpet"
import { logger } from "hono/logger"
import type { PetPetParams, Hash } from "./types"

import {
	checkValidRequestParams,
	error,
	getConfig,
	green,
	info,
	isLogfeatureEnabled,
	log,
} from "./functions"
import { getGlobalOption, getServerOption } from "./config"
import { PetPet } from "./db"
import { processFlags } from "./flags"
import type { Server } from "bun"
import { genConfig } from "./genConfig"

var args = process.argv.slice(2),
	app = new Hono(),
	server: Server = {} as Server,
	intervalID: Timer,
	chechCache = () => {
		/* var i = 0
		for (var hash in petpets)
			if ((i += +checkPetPetCache(hash))) deletePetPet(hash)
		// console.log(`Found: ${i} outdated petpets`)
		if (i > 0)
			console.log(
				`${i} user${i ? "s" : ""} ${i ? "were" : "was"} deleted from cache.`,
			) */
	}

app.use("/:id", async (c, next) => {
	if (isLogfeatureEnabled("rest")) logger()(c, next)
})

app.get("/:id", async (c) => {
	var userID = c.req.param("id"),
		shiftRaw = c.req.query("shift"),
		updateRaw = !!c.req.url.match(/[?&]upd(&|=|$)/),
		sizeRaw = c.req.query("size"),
		resizeRaw = c.req.query("resize"),
		fpsRaw = c.req.query("fps"),
		squeezeRaw = c.req.query("squeeze"),
		needNeewImage = false,
		shiftX = defaultPetPetParams.shiftX,
		shiftY = defaultPetPetParams.shiftY,
		size = defaultPetPetParams.size,
		fps = defaultPetPetParams.fps,
		resizeX = defaultPetPetParams.resizeX,
		resizeY = defaultPetPetParams.resizeY,
		squeeze = defaultPetPetParams.squeeze,
		notValidParams = checkValidRequestParams(c, {
			userID,
			shift: shiftRaw,
			size: sizeRaw,
			resize: resizeRaw,
			fps: fpsRaw,
			squeeze: squeezeRaw,
		})

	// console.log("Request params: ", { userID, shift, size, resize, fps })
	if (notValidParams) return notValidParams

	var petpetHash: Hash = `${userID}-${shiftRaw}-${sizeRaw}-${resizeRaw}-${fpsRaw}-${squeezeRaw}`

	if (shiftRaw) [shiftX, shiftY] = shiftRaw.split("x").map(Number)
	if (sizeRaw) size = +sizeRaw
	if (fpsRaw) fps = +fpsRaw
	if (resizeRaw) [resizeX, resizeY] = resizeRaw.split("x").map(Number)
	if (squeezeRaw) squeeze = +squeezeRaw
	var petpetParams: PetPetParams = {
		shiftX,
		shiftY,
		size,
		fps,
		resizeX,
		resizeY,
		squeeze,
	}

	try {
		var petpet: PetPet,
			tempPetpet = getPetPet(petpetHash)

		if (tempPetpet) petpet = tempPetpet
		else {
			petpet = createPetPet(petpetHash, userID)
		}

		needNeewImage = !tempPetpet || updateRaw

		if (!needNeewImage) {
			// console.log("Gif was in cache")
			petpet.lastSeen = Date.now()
			updatePetPet(petpet)
			return new Response(petpet.gif, {
				headers: { "Content-Type": "image/gif" },
			})
		}

		// console.time("Gif created")

		var gif = await generatePetPet(petpet)

		// console.timeEnd("Gif created")

		if (gif instanceof Response) {
			return c.json(
				{
					error: `Failed to get the user's avatar"`,
					response: gif,
				},
				{ status: gif.status },
			)
		} else {
			petpet.gif = gif
			petpet.lastSeen = Date.now()
			updatePetPet(petpet)
			return new Response(gif, {
				headers: {
					"Content-Type": "image/gif",
				},
			})
		}
	} catch (e) {
		console.error(`Error while processing GET /${userID} :\n`, e)
		return c.json(
			{
				ok: false,
				code: 500,
				statusText: "Internal Server Error",
				message: "Something went wrong during processing the request.",
			},
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		)
	}
})

app.get("/avatar/:id", async (c) => {
	var id = c.req.param("id")
	if (!/^\d+$/.test(id))
		return c.json(
			{
				ok: false,
				code: 400,
				message: "Invalid ID. ID must contain only digits from 0 to 9",
			},
			{ status: 400 },
		)
	else {
		var avatar = await fetchAvatar(id)
		return avatar instanceof Buffer
			? new Response(avatar, {
					headers: { "Content-Type": "image/png" },
				})
			: c.json({ ok: false }, { status: avatar.status })
	}
})

app.get("*", (c) => c.json({ ok: true }, 204))

function setupWatch() {
	var watcher = fs.watch(".", (_, filename) => {
		var configFile = getGlobalOption("configFile")
		if (!getGlobalOption("useConfig")) return
		else if (filename === "config.toml") getConfig()
		else if (filename === ".env")
			if (configFile === "default" || configFile === ".env") getConfig()
	})
	watcher.on("error", (e) =>
		log("error", error(`Error while watching config files for change`), e),
	)
	return watcher
}

function listening() {
	log("info", info(`Listening on URL: ${green(server.url)}`))
}

function restart() {
	if (intervalID) clearInterval(intervalID)
	processFlags(args)

	intervalID = setInterval(chechCache, 60_000)

	if (server) server?.stop?.()

	server = Bun.serve({
		fetch: app.fetch,
		port: getServerOption("port"),
		hostname: getServerOption("host"),
	})
	if (getGlobalOption("useConfig")) getConfig().then(listening)
	else listening()
}

restart()
