fileNotForRunning()

import fs from "fs"
import { join } from "path"
import { getGlobalOption, ROOT_PATH } from "./config"
import {
	compress,
	decompress,
	error,
	fileNotForRunning,
	log,
	updateObject,
} from "./functions"
import { fetchAvatar, generatePetPet } from "./petpet"
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
} from "./types"

var petpets: PetPets = new Map(),
	avatars: Avatars = new Map(),
	petpetQueue: PetPetQueue = new Map(),
	avatarQueue: AvatarQueue = new Map(),
	cacheDir = join(ROOT_PATH, "../cache/") as `${string}/cache`,
	gifCacheDir = join(cacheDir, "gif") as `${string}/cache/gif`,
	avatarCacheDir = join(cacheDir, "avatar") as `${string}/cache/avatar`

/** Object for configuring cache in code and filesystem */
export var cache: Cache = {
	gif: {
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
			delete(hash) {
				return getGlobalOption("cache") ? petpets.delete(hash) : false
			},
			checkCacheTime(hash) {
				return getGlobalOption("cache")
					? checkCacheTime(
							petpets
								.values()
								.find((petpet) => petpet.hash === hash)
								?.lastSeen ?? 0,
						)
					: false
			},
		},
		fs: {
			async set(id, hash, lastSeen, gif) {
				if (!getGlobalOption("cache")) return false
				var json = JSON.stringify({ id, hash, lastSeen }),
					fileName = `${id}_${hash}`
				return new Promise<boolean>((resolve) => {
					Bun.write(join(gifCacheDir, `${fileName}.json`), json)
						.catch(
							(e) => (
								log(
									"error",
									error(
										"Error while tryingto create .json file for gif: ",
									),
									e,
								),
								resolve(false)
							),
						)
						.then(() =>
							Bun.write(
								join(gifCacheDir, `${fileName}.gif`),
								new Uint8Array(gif),
							),
						)
						.catch(
							(e) => (
								log(
									"error",
									error(
										"Error while tryingto create .gif file: ",
									),
									e,
								),
								resolve(false)
							),
						)
						.then(() => resolve(true))
				})
			},
			async get(hash) {
				if (!getGlobalOption("cache")) return undefined
				var file = Bun.file(
					join(gifCacheDir, `${hash.match(/^\d+(?=-)/)}_${hash}.gif`),
				)
				return file
					.exists()
					.then(() => file.bytes().then((data) => Buffer.from(data)))
					.catch(() => undefined)
			},
			async has(hash) {
				if (!getGlobalOption("cache")) return false
				return Bun.file(
					join(gifCacheDir, `${hash.match(/^\d+(?=-)/)}_${hash}.gif`),
				)
					.exists()
					.catch(() => false)
			},
			delete(hash) {
				if (!getGlobalOption("cache")) return false
				var filename = `${hash.match(/^\d+(?=-)/)}_${hash}`
				try {
					fs.rmSync(join(gifCacheDir, `${filename}.json`))
					fs.rmSync(join(gifCacheDir, `${filename}.gif`))
					return true
				} catch {
					return false
				}
			},
			async checkCacheTime(hash) {
				if (!getGlobalOption("cache")) return false
				return new Promise<boolean>(async (resolve) => {
					var file = Bun.file(
						join(
							gifCacheDir,
							`${hash.match(/^\d+(?=-)/)}_${hash}.json`,
						),
					)
					return file
						.exists()
						.then((exists) =>
							exists
								? file
										.json()
										.then((data) =>
											resolve(
												checkCacheTime(data.lastSeen),
											),
										)
								: resolve(false),
						)
						.catch(() => resolve(false))
				})
			},
			checkSafe(hash) {
				if (!getGlobalOption("cache")) return false
				return (
					fs
						.readdirSync(gifCacheDir)
						.filter((name) => name.includes(hash)).length === 2
				)
			},
		},
	},
	avatar: {
		code: {
			set(avatar: Avatar) {
				return getGlobalOption("avatars")
					? (avatars.has(avatar.id)
							? updateObject(avatars.get(avatar.id)!, avatar)
							: avatars.set(avatar.id, avatar),
						true)
					: false
			},
			get(id: string) {
				return getGlobalOption("avatars") ? avatars.get(id) : undefined
			},
			has(id: string) {
				return getGlobalOption("avatars") ? avatars.has(id) : false
			},
			delete(id: string) {
				return getGlobalOption("avatars") ? avatars.delete(id) : false
			},
			checkDependencies(id) {
				if (!getGlobalOption("avatars")) return false
				return petpets.values().some((petpet) => petpet.id === id)
			},
		},
		fs: {
			async set(id: string, avatar: Buffer) {
				if (!getGlobalOption("avatars")) return false
				if (!checkCacheTypeExist("avatar")) fs.mkdirSync(avatarCacheDir)
				return Bun.write(
					join(avatarCacheDir, `${id}.png`),
					new Uint8Array(avatar),
				)
					.then(() => true)
					.catch(() => false)
			},
			async get(id: string) {
				if (!getGlobalOption("avatars")) return undefined
				var file = Bun.file(join(cacheDir, `${id}.png`))
				return file
					.exists()
					.then((exists) =>
						exists
							? file
									.bytes()
									.then(Buffer.from)
									.catch(() => undefined)
							: undefined,
					)
					.catch(() => undefined)
			},
			async has(id: string) {
				if (!getGlobalOption("avatars")) return false
				return Bun.file(join(avatarCacheDir, `${id}.png`))
					.exists()
					.catch(() => false)
			},
			delete(id: string) {
				try {
					fs.rmSync(join(avatarCacheDir, `${id}.png`))
					return true
				} catch {
					return false
				}
			},
			async checkDependencies(id) {
				if (!getGlobalOption("avatars")) return false
				return fs.readdirSync(gifCacheDir).some((e) => e.startsWith(id))
			},
		},
	},
}

function checkCacheTime(time: number) {
	return time < getGlobalOption("cacheTime")
}

function checkCacheTypeExist<T extends "gif" | "avatar">(type: T) {
	return fs.existsSync(join(cacheDir, type))
}

export function addPetpetToQueue(
	hash: Hash,
	avatar: Buffer,
	params: PetPetParams,
) {
	petpetQueue.set(
		hash,
		new Promise((resolve, reject) => {
			generatePetPet(avatar, params).then(resolve).catch(reject)
		}),
	)
}

export function addAvatarToQueue(id: string) {
	avatarQueue.set(
		id,
		new Promise<Buffer>((resolve, reject) => {
			fetchAvatar(id)
				.then((result) => {
					if (result instanceof Buffer) resolve(result)
					else reject(result)
				})
				.catch((e) => {
					log("error", error("Error while fetching avatar: "), e)
					reject({ e })
				})
		}),
	)
}

export function getPetPetImageFromQueue(hash: Hash) {
	return new Promise<Buffer | undefined>((resolve) => {
		if (petpetQueue.has(hash)) {
			petpetQueue
				.get(hash)!
				.then(resolve)
				.catch((e) => {
					log("error", error("Error while creating PetPet Gif: "), e)
					resolve(undefined)
				})
		} else resolve(undefined)
	})
}

export class PetPet implements PetPetType {
	#gif: Buffer
	hash: Hash
	id: string
	lastSeen: number

	constructor(id: string, hash: Hash, gif: Buffer) {
		this.id = id
		this.hash = hash
		this.lastSeen = Date.now()
		this.#gif = gif
	}

	get gif() {
		return decompress(this.#gif)
	}
	set gif(value) {
		this.#gif = compress(value)
	}
}

export class Avatar implements AvatarType {
	#avatar: Buffer
	id: string

	constructor(id: string, avatar: Buffer) {
		this.id = id
		this.#avatar = avatar
	}

	get avatar() {
		return decompress(this.#avatar)
	}
	set avatar(value) {
		this.#avatar = compress(value)
	}
}
