import { Hono } from "hono"
import { fetchAvatar, generatePetPet } from "./petpet"
import { logger } from "hono/logger"
import type { Avatars, User, Users as Petpets } from "./types"
import {
	checkPetPetToLongInCache,
	checkValidRequestParams,
	createPetPet,
	deletePetPet,
	getPetPet,
	processFlags,
	updatePetPet,
} from "./functions"

var args = process.argv.slice(2),
	app = new Hono(),
	server = Bun.serve({
		fetch() {
			return new Response("")
		},
	}),
	intervalID: Timer,
	chechCache = () => {
		// console.log("Performing cleanup")

		var i = 0
		for (var hash in petpets)
			if ((i += +checkPetPetToLongInCache(hash))) deletePetPet(hash)
		// console.log(`Found: ${i} outdated petpets`)
		if (i > 0)
			console.log(
				`${i} user${i > 1 ? "s" : ""} ${i > 1 ? "were" : "was"} deleted from cache.`,
			)
	}

export var petpets: Petpets = {},
	avatars: Avatars = {}

app.use("/:id", logger())

app.get("/:id", async (c) => {
	var userID = c.req.param("id"),
		shift = c.req.query("shift"),
		update = !!c.req.query("upd"),
		size = c.req.query("size"),
		resize = c.req.query("resize"),
		fps = c.req.query("fps"),
		squeeze = c.req.query("squeeze"),
		needNeewImage = false,
		shiftX = 0,
		shiftY = 0,
		size_ = 100,
		fps_ = 16,
		squeeze_ = 15,
		resizeX = 0,
		resizeY = 0,
		validParams = checkValidRequestParams(c, {
			userID,
			shift,
			size,
			resize,
			fps,
			squeeze,
		})

	// console.log("Request params: ", { userID, shift, size, resize, fps })
	if (validParams) return validParams

	var petpetHash = `${userID}${shift}${size}${resize}${fps}`

	if (shift) [shiftX, shiftY] = shift.split("x").map(Number)
	if (size) size_ = +size
	if (fps) fps_ = +fps
	if (resize) [resizeX, resizeY] = resize.split("x").map(Number)
	if (squeeze) squeeze_ = +squeeze

	try {
		var user: User,
			tempuser = getPetPet(petpetHash)

		if (tempuser) {
			// console.log("User was in cache!")
			user = tempuser
		} else {
			user = createPetPet(petpetHash, userID)
			// console.log("User created!")
		}

		needNeewImage = !tempuser || update || !user.hasImage

		if (!needNeewImage) {
			console.log("Gif was in cache")
			user.lastSeen = Date.now()
			updatePetPet(user)
			return new Response(user.gif, {
				headers: { "Content-Type": "image/gif" },
			})
		}

		console.time("Gif created")

		var gif = await generatePetPet(user, {
			shiftX,
			shiftY,
			size: size_,
			fps: fps_,
			resizeX,
			resizeY,
			squeeze: squeeze_,
		})

		console.timeEnd("Gif created")

		if (gif instanceof Response) {
			return c.json(
				{
					error: `Failed to get the user's avatar"}`,
					response: gif,
				},
				{ status: gif.status },
			)
		} else {
			user.gif = gif
			user.lastSeen = Date.now()
			updatePetPet(user)
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

function restart() {
	if (intervalID) clearInterval(intervalID)

	processFlags(args)

	intervalID = setInterval(chechCache, 60_000)

	if (server) server.stop()

	server = Bun.serve({
		fetch: app.fetch,
		port: 3000,
		// hostname: "0.0.0.0",
	})
}

restart()

if (server) console.log(`Listening on URL: \x1b[32m${server.url}\x1b[0m`)
