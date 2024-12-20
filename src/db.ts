fileNotForRunning()

import fs from "fs"
import { join } from "path"
import { getGlobalOption, ROOT_PATH } from "./config"
import {
	compress,
	decompress,
	error,
	fileNotForRunning,
	isCurrentCacheType,
	log,
	updateObject,
	verboseError,
} from "./functions"
import { generatePetPet } from "./petpet"
import type {
	AvatarQueue,
	Avatars,
	PetPetType,
	PetPetParams,
	PetPetQueue,
	PetPets,
	AvatarType,
	Cache,
	Hash,
	Stats,
} from "./types"
import { fetchAvatar } from "./avatars"

type BufferType = "gif" | "avatar"

var petpets: PetPets = new Map(),
	avatars: Avatars = new Map(),
	petpetQueue: PetPetQueue = new Map(),
	avatarQueue: AvatarQueue = new Map(),
	hashRegex = /\d+--?\d+x-?\d+--?\d+x-?\d+-\d?\d--?\d+/g,
	idRegex = /\d+/g,
	// poor windows with it's `\` 😂
	cacheDir = join(ROOT_PATH, "cache") as `${string}/cache`,
	gifCacheDir = join(cacheDir, "gif") as `${string}/cache/gif`,
	avatarCacheDir = join(cacheDir, "avatar") as `${string}/cache/avatar`

export var requestTime = {
		fromScratch: [] as number[],
		fromCache: [] as number[],
	},
	/** Object for configuring queues and cache in code and filesystem */
	cache: Cache = {
		gif: {
			queue: {
				add(hash: Hash, avatar: Uint8Array, params?: PetPetParams) {
					var promise = generatePetPet(avatar, params)
					promise.then((buffer) => {
						addPetPetToCache(new PetPet(hash, buffer))
						petpetQueue.delete(hash)
					})
					petpetQueue.set(hash, promise)
					return promise
				},
				addWithAvatar(hash, params, size) {
					var id = hash.match(/^\d+/)?.[0] ?? "1234",
						promise = new Promise<Uint8Array>((resolve) => {
							cache.avatar.queue.add(id, size).then((png) => {
								generatePetPet(png, params).then((gif) => {
									addPetPetToCache(new PetPet(hash, gif))
									petpetQueue.delete(hash)
									resolve(gif)
								})
							})
						})
					petpetQueue.set(hash, promise)
					return promise
				},
				has(hash) {
					return petpetQueue.has(hash)
				},
				get(hash) {
					return petpetQueue.get(hash)
				},
			},
			code: {
				set(petpet: PetPet) {
					return getGlobalOption("cache")
						? (petpets.has(petpet.hash)
								? updateObject(petpets.get(petpet.hash)!, petpet)
								: petpets.set(petpet.hash, petpet),
							true)
						: false
				},
				get(hash) {
					return getGlobalOption("cache") ? petpets.get(hash) : undefined
				},
				has(hash) {
					return getGlobalOption("cache") ? petpets.has(hash) : false
				},
				remove(hash) {
					return getGlobalOption("cache") ? petpets.delete(hash) : false
				},
				checkCacheTime(hash) {
					return getGlobalOption("cache")
						? checkCacheTime(petpets.has(hash) ? petpets.get(hash)!?.lastSeen : 0)
						: false
				},
				get hashes() {
					return getGlobalOption("cache") ? Array.from(petpets.keys()) : []
				},
				clear() {
					var amount = getGlobalOption("cache") ? petpets.size : 0
					petpets.clear()
					return amount
				},
			},
			fs: {
				async set(petpet) {
					if (!getGlobalOption("cache")) return false
					checkAndCreateCacheType("gif")
					var json = JSON.stringify(
						{
							id: petpet.id,
							hash: petpet.hash,
							lastSeen: petpet.lastSeen,
						},
						null,
						"\t",
					)
					return new Promise<boolean>((resolve) => {
						Bun.write(join(gifCacheDir, `${petpet.hash}.json`), json).then(
							() =>
								Bun.write(join(gifCacheDir, `${petpet.hash}.gif`), petpet.gif).then(
									() => resolve(true),

									(e) => {
										log(
											"error",
											error("Error while tryingto create .gif file:\n"),
											e,
										)
										resolve(false)
									},
								),
							(e) => {
								log(
									"error",
									error("Error while trying to create .json file for gif:\n"),
									e,
								)
								resolve(false)
							},
						)
					})
				},
				async get(hash) {
					if (!getGlobalOption("cache")) return undefined
					checkAndCreateCacheType("gif")
					var file = Bun.file(join(gifCacheDir, `${hash}.gif`))
					return file
						.exists()
						.then((exists) => (exists ? file.bytes() : undefined))
						.catch(() => undefined)
				},
				has(hash) {
					if (!getGlobalOption("cache")) return false
					checkAndCreateCacheType("gif")
					return fs.existsSync(join(gifCacheDir, `${hash}.gif`))
				},
				remove(hash) {
					if (!getGlobalOption("cache")) return false
					checkAndCreateCacheType("gif")
					try {
						fs.rmSync(join(gifCacheDir, `${hash}.json`))
						fs.rmSync(join(gifCacheDir, `${hash}.gif`))
						return true
					} catch {
						return false
					}
				},
				async checkCacheTime(hash) {
					if (!getGlobalOption("cache")) return false
					checkAndCreateCacheType("gif")
					return new Promise<boolean>(async (resolve) => {
						var file = Bun.file(
								join(gifCacheDir, `${hash.match(/^\d+(?=-)/)}_${hash}.json`),
							),
							rf = () => resolve(false)

						return file
							.exists()
							.then(
								(exists) =>
									exists
										? file
												.json()
												.then(
													(data) =>
														resolve(
															checkCacheTime(data?.lastSeen ?? 0),
														),
													rf,
												)
										: resolve(false),
								rf,
							)
					})
				},
				checkSafe(hash) {
					checkAndCreateCacheType("gif")
					return getGlobalOption("cache")
						? fs.readdirSync(gifCacheDir).join(",").match(new RegExp(hash, "g"))
								?.length === 2
						: false
				},
				get hashes() {
					checkAndCreateCacheType("gif")
					var result: string[] = []
					if (!getGlobalOption("cache")) return result as Array<Hash>
					return fs.readdirSync(gifCacheDir).reduce((a, filename) => {
						var hash = filename.match(hashRegex)?.[0]
						if (hash) if (!a.includes(hash)) a.push(hash)
						return a
					}, result) as Array<Hash>
				},
				clear() {
					checkAndCreateCacheType("gif")
					var amount = getGlobalOption("cache")
						? fs.readdirSync(gifCacheDir).reduce((a, f) => {
								var filename = f.match(hashRegex)?.[0] as Hash | undefined
								if (filename) if (!a.has(filename)) a.add(filename)

								return a
							}, new Set<Hash>()).size
						: 0
					// bruh, why there are no safe way of doing that?
					try {
						fs.rmdirSync(gifCacheDir)
					} catch {}
					try {
						fs.mkdirSync(gifCacheDir)
					} catch {}

					return amount
				},
			},
		},
		avatar: {
			queue: {
				add(id: string, size?: number) {
					var promise = new Promise<Uint8Array>((resolve, reject) => {
						fetchAvatar(id, size).then(
							(result) => resolve(result),
							(e) => {
								verboseError(
									e,
									error("Error while fetching avatar:\n"),
									error("Error while fetching avatar"),
								)
								reject(e)
							},
						)
					})
					promise.then((png) => {
						addAvatarToCache(new Avatar(id, png))
						avatarQueue.delete(id)
					})
					avatarQueue.set(id, promise)
					return promise
				},
				has(id) {
					return avatarQueue.has(id)
				},
				get(id) {
					return avatarQueue.get(id)
				},
			},
			code: {
				set(avatar) {
					return getGlobalOption("avatars")
						? (avatars.set(avatar.id, avatar), true)
						: false
				},
				get(id) {
					return getGlobalOption("avatars") ? avatars.get(id) : undefined
				},
				has(id) {
					return getGlobalOption("avatars") ? avatars.has(id) : false
				},
				remove(id) {
					return getGlobalOption("avatars") ? avatars.delete(id) : false
				},
				checkDependencies(id) {
					if (!getGlobalOption("avatars")) return false
					return petpets.values().some((petpet) => petpet.id === id)
				},
				get IDs() {
					return getGlobalOption("avatars") ? Array.from(avatars.keys()) : []
				},
				clear() {
					var amount = getGlobalOption("cache") ? avatars.size : 0
					avatars.clear()
					return amount
				},
			},
			fs: {
				async set(avatar) {
					if (!getGlobalOption("avatars")) return false
					checkAndCreateCacheType("avatar")
					return Bun.write(
						join(avatarCacheDir, `${avatar.id}.png`),
						new Uint8Array(avatar.avatar),
					).then(
						() => true,
						() => false,
					)
				},
				async get(id) {
					if (!getGlobalOption("avatars")) return undefined
					checkAndCreateCacheType("avatar")
					var file = Bun.file(join(avatarCacheDir, `${id}.png`))
					return file
						.exists()
						.then((exists) => (exists ? file.bytes() : undefined))
						.catch(() => undefined)
				},
				has(id) {
					if (!getGlobalOption("avatars")) return false
					checkAndCreateCacheType("avatar")
					return fs.existsSync(join(avatarCacheDir, `${id}.png`))
				},
				remove(id) {
					checkAndCreateCacheType("avatar")
					try {
						fs.rmSync(join(avatarCacheDir, `${id}.png`))
						return true
					} catch {
						return false
					}
				},
				async checkDependencies(id) {
					if (!getGlobalOption("avatars")) return false
					checkAndCreateCacheType("avatar")
					return fs.readdirSync(gifCacheDir).some((e) => e.startsWith(id))
				},
				get IDs() {
					checkAndCreateCacheType("avatar")
					var result: string[] = []
					if (!getGlobalOption("cache")) return result as Array<Hash>
					return fs.readdirSync(gifCacheDir).reduce((a, filename) => {
						var hash = filename.match(hashRegex)?.[0]
						if (hash) if (!a.includes(hash)) a.push(hash)
						return a
					}, result) as Array<Hash>
				},
				clear() {
					checkAndCreateCacheType("avatar")
					var amount = getGlobalOption("cache")
						? fs.readdirSync(avatarCacheDir).reduce((a, f) => {
								var filename = f.match(idRegex)?.[0]
								if (filename) if (!a.has(filename)) a.add(filename)

								return a
							}, new Set<string>()).size
						: 0
					try {
						fs.rmdirSync(avatarCacheDir)
					} catch {}
					try {
						fs.mkdirSync(avatarCacheDir)
					} catch {}

					return amount
				},
			},
		},
	},
	/** Statistics for the whole server lifetime */
	stats: Stats = {
		cache: {
			get type() {
				return getGlobalOption("cacheType")
			},
			gif: {
				get inCache() {
					var result = 0
					if (isCurrentCacheType("code")) result += petpets.size
					if (isCurrentCacheType("fs")) result += cache.gif.fs.hashes.length
					return result
				},
				get processing() {
					return petpetQueue.size
				},
			},
			avatar: {
				get inCache() {
					var result = 0
					if (isCurrentCacheType("code")) result += avatars.size
					if (isCurrentCacheType("fs")) result += cache.avatar.fs.IDs.length
					return result
				},
				get processing() {
					return avatarQueue.size
				},
			},
		},
		request: { routes: ["/:id", "/avatar/:id"] as const },
		response: {
			routes: {
				"/:id": {
					successful: 0,
					failed: 0,
					total: 0,
				},
				"/avatar/:id": {
					successful: 0,
					failed: 0,
					total: 0,
				},
			},
			average: {
				get fromScratch() {
					return +(
						requestTime.fromScratch.reduce((a, c) => a + c, 0) /
						(requestTime.fromScratch.length || 1)
					).toFixed(4)
				},
				get fromCache() {
					return +(
						requestTime.fromCache.reduce((a, c) => a + c, 0) /
						(requestTime.fromCache.length || 1)
					).toFixed(4)
				},
			},
			failed: 0,
			successful: 0,
			total: 0,
		},
	},
	// controll over responses in statistics
	statControll = {
		response: {
			common: {
				increment: {
					/** Increment "/:id" success count by optional value, or 1 */
					success(value = 1) {
						stats.response.routes["/:id"].successful += value
						stats.response.routes["/:id"].total += value
						stats.response.total += value
						stats.response.successful += value
					},
					/** Decrement "/:id" failed count by optional value, or 1 */
					failure(value = 1) {
						stats.response.routes["/:id"].failed += value
						stats.response.routes["/:id"].total += value
						stats.response.total += value
						stats.response.failed += value
					},
				},
				/** Reset "/:id" response counters */
				reset() {
					var obj = stats.response.routes["/:id"]
					obj.successful = 0
					obj.total = 0
					obj.failed = 0
				},
			},
			avatars: {
				increment: {
					/** Increment "/avatar/:id" success count by optional value, or 1 */
					success(value = 1) {
						stats.response.routes["/avatar/:id"].successful += value
						stats.response.routes["/avatar/:id"].total += value
						stats.response.failed += value
					},
					/** Decrement "/avatar/:id" failed count by optional value, or 1 */
					failure(value = 1) {
						stats.response.routes["/avatar/:id"].failed += value
						stats.response.routes["/avatar/:id"].total += value
						stats.response.failed += value
					},
				},
				/** Reset "/avatar/:id" response counters */
				reset() {
					var obj = stats.response.routes["/avatar/:id"]
					obj.successful = 0
					obj.total = 0
					obj.failed = 0
				},
			},
		},
		all: {
			/** Reset general response counters */
			reset() {
				var obj = stats.response
				obj.successful = 0
				obj.total = 0
				obj.failed = 0
			},
			/** Reset all response counters (all sub routes also) */
			hardReset() {
				stats.response.successful = 0
				stats.response.total = 0
				stats.response.failed = 0
				var routes = stats.response.routes
				for (var r in stats.response.routes) {
					var route = r as keyof typeof routes
					routes[route].total = 0
					routes[route].successful = 0
					routes[route].failed = 0
				}
			},
		},
	}

function addAvatarToCache(avatar: Avatar) {
	if (getGlobalOption("cache")) {
		if (isCurrentCacheType("code")) avatars.set(avatar.id, avatar)
		if (isCurrentCacheType("fs")) cache.avatar.fs.set(avatar)
	}
}
function addPetPetToCache(petpet: PetPet) {
	if (getGlobalOption("cache")) {
		if (isCurrentCacheType("code")) petpets.set(petpet.hash, petpet)
		if (isCurrentCacheType("fs")) cache.gif.fs.set(petpet)
	}
}

function checkCacheTime(time: number) {
	return time < getGlobalOption("cacheTime")
}

function checkCacheTypeExist<T extends BufferType>(type: T) {
	return fs.existsSync(join(cacheDir, type))
}

function createCacheType<T extends BufferType>(type: T) {
	try {
		fs.mkdirSync(join(cacheDir, type), { recursive: true })
	} catch {}
}

function checkAndCreateCacheType<T extends BufferType>(type: T) {
	if (!checkCacheTypeExist(type)) createCacheType(type)
}
export class PetPet implements PetPetType {
	#gif!: Uint8Array
	hash: Hash
	id: string
	lastSeen: number

	constructor(hash: Hash, gif: Uint8Array) {
		this.id = hash.match(/^\d+/)?.[0] ?? ""
		this.hash = hash
		this.lastSeen = Date.now()
		// set the Uint8Array, automaticaly invoking the setter function
		this.gif = gif
	}

	get gif() {
		return getGlobalOption("compression") ? decompress(this.#gif) : this.#gif
	}
	set gif(value) {
		this.#gif = getGlobalOption("compression") ? compress(value) : value
	}
}

export class Avatar implements AvatarType {
	#avatar!: Uint8Array
	id: string

	constructor(id: string, avatar: Uint8Array) {
		this.id = id
		// set the Uint8Array, automaticaly invoking the setter function
		this.avatar = avatar
	}

	get avatar() {
		return getGlobalOption("compression") ? decompress(this.#avatar) : this.#avatar
	}
	set avatar(value) {
		this.#avatar = getGlobalOption("compression") ? compress(value) : value
	}
}
