import type { Context } from "hono"
import fs from "node:fs"
import path from "path"
import { avatars, petpets } from "."
import type {
	ChechValidParamsParam,
	Flag,
	FlagContext,
	FlagLong,
	FlagLongNoRequire,
	FlagShort,
	FlagShortNoRequire,
	GetFlagProp,
	LogOption,
	LogOptionLong,
	LogOptionLongCombination,
	TOMLConfig,
	TupleToUnion,
	UnionToTuple,
	User,
} from "./types"
import { globalOptions } from "./config"
import zlib from "zlib"
import { genConfig } from "./genConfig"
import { green } from "./help"
import { setLogOption } from "./tsDanger"
import { TOML } from "bun"

var readHelpPage =
		"Run `bun run help` or `bun start -h` to read the help page to see the correct flag usage" as const,
	allFlagsShort = [
		"q",
		"h",
		"v",
		"c",
		"C",
		"A",
		"a",
		"l",
		"L",
		"g",
		"o",
	] as const,
	shortFlagsRequireOrExit = ["l", "c", "h", "v"] as const,
	printHelp = await import("./help").then((m) => m.default)

/** Log things based on log options enabled */
export function log(dependency: LogOptionLongCombination, ...args: any[]) {
	var doLog = false
	if (dependency.includes(",")) {
		var deps = dependency.split(/,/g) as LogOptionLong[]
		for (var dep of deps) if (globalOptions.logOptions[dep]) doLog = true
	} else if (globalOptions.logOptions[dependency as LogOptionLong])
		doLog = true

	doLog ? console.log(...args) : void 0
}

export function warning(text: string) {
	if (globalOptions.warnings) console.log(`\x1b[33m[Warning] ${text}\x1b[0m`)
}

export function error(text: string) {
	if (globalOptions.errors) console.log(`\x1b[31m[Error] ${text}\x1b[0m`)
}

export function getPetPets() {
	return petpets
}

export function createPetPet(hash: string, id: string): User {
	return {
		hash,
		id,
		gif: Buffer.alloc(0),
		hasImage: false,
		lastSeen: Date.now(),
	}
}

export function getPetPet(hash: string) {
	return petpets[hash]
}

export function checkPetPetToLongInCache(hash: string) {
	return (
		Date.now() -
			(getPetPet(hash) ?? { lastSeen: globalOptions.cacheTime - 1 })
				.lastSeen >
		globalOptions.cacheTime
	)
}

export function deletePetPet(hash: string) {
	delete petpets[hash]
}

export function updateObject<T extends Record<any, any>>(
	original: T,
	source: T,
) {
	for (var key in source)
		if (Object.hasOwn(original, key)) original[key] = source[key]
}

export async function updatePetPet(user: User) {
	petpets[user.hash]
		? updateObject(petpets[user.hash], user)
		: (petpets[user.hash] = user)
}

export function memoize<T, P extends any[]>(fn: (...args: P) => T, ...args: P) {
	var result: T,
		hasResult = false
	return {
		get value() {
			if (!hasResult) {
				result = fn(...args)
				hasResult = true
			}
			return result
		},
	}
}

export async function chechPetPet(hash: string) {
	return !!petpets[hash]
}

export function checkValidRequestParams(
	c: Context,
	{ userID, size, shift, resize, fps, squeeze }: ChechValidParamsParam,
) {
	var badRequest = (message: string) =>
		c.json(
			{ ok: false as const, message, statusText: "Bad Request" as const },
			{ status: 400 as const },
		)

	if (!/^\d+$/.test(userID))
		return badRequest(
			"Invalid user id. Usage: '{Integer}'. Ex: '117378255429959680'",
		)
	if (size && !/^\d?\d?\d?$/.test(size))
		return badRequest(
			"Invalid size parameter. Usage: '{Integer}'. Ex: '20', '90'",
		)
	if (size && /^\d?\d?\d$/.test(size) && +size > 112 && +size < 1)
		return badRequest(
			"Size parameter out of range. Use only integers (0-9) in range [1, 112]",
		)
	if (shift && !/^-?\d+x-?\d+$/.test(shift))
		return badRequest(
			"Invalid shift parameter. Usage: '{Integer}x{Integer}'. Ex: '-5x20', '15x10'",
		)
	if (
		shift &&
		/^-?\d+x-?\d+$/.test(shift) &&
		!shift
			.split("x")
			?.map((e) => /-?\d+/.test(e) && !isNaN(+e))
			.every((e) => e)
	)
		return badRequest(
			"Invalid shift parameter value. Use only integers (0-9) in range (-Infinity, +Infinity)",
		)
	if (resize && !/^-?\d+x-?\d+$/.test(resize))
		return badRequest(
			"Invalid resize parameter. Usage: '{Integer}x{Integer}'. Ex: '-5x20', '15x10'",
		)
	if (
		resize &&
		/^-?\d+x-?\d+$/.test(resize) &&
		!resize
			.split("x")
			?.map((e) => /-?\d+/.test(e) && !isNaN(+e))
			.every((e) => e)
	)
		return badRequest(
			"Invalid resize parameter value. Use only integers (0-9) in range (-Infinity, +Infinity)",
		)
	if (fps && !/^\d?\d$/.test(fps))
		return badRequest(
			"Invalid fps parameter. Usage: '{Integer}'. Ex: '10', '14' Please take notice about gif frame rate compatiability. Read 'https://www.fileformat.info/format/gif/egff.htm' for more information",
		)
	if (fps && /^\d?\d$/.test(fps) && +fps < 1)
		return badRequest(
			"Invalid fps parameter value. Use only integers (0-9) in range [1, 50) (recomended). Please take notice about gif frame rate compatiability. Read 'https://www.fileformat.info/format/gif/egff.htm' for more information",
		)
	if (squeeze && !/^\d+$/.test(squeeze))
		return badRequest(
			"Invalid squeeze parameter. Usage: '{Integer}'. Ex: '10', '-20'",
		)
	if (squeeze && /^\d+$/.test(squeeze) && isNaN(+squeeze))
		return badRequest(
			"Invalid fps parameter value. Use only integers (0-9)",
		)
}

export function setAvatar(id: string, buffer: Buffer) {
	avatars[id] = compress(buffer)
}

export function getAvatar(id: string) {
	return avatars[id] ? deecompress(avatars[id]) : void 0
}
export function deleteAvatar(id: string) {
	return delete avatars[id]
}

export function compress(buffer: Buffer) {
	return zlib.brotliCompressSync(buffer)
}

export function deecompress(buffer: Buffer) {
	return zlib.brotliDecompressSync(buffer)
}

export function errorAndExit(...args: any[]) {
	console.error(...args)
	process.exit()
}

export function setShortFlag<F extends FlagShort, V extends GetFlagProp<F>>(
	flag: F,
	value: V,
): void
export function setShortFlag<F extends FlagShortNoRequire>(flag: F): void
export function setShortFlag<F extends FlagShort, V extends GetFlagProp<F>>(
	flag: F,
	value?: V,
): void {
	if (flag == "q") globalOptions.quiet = true
	else if (flag == "C") globalOptions.cache = false
	else if (flag == "A") globalOptions.avatars = false
	else if (flag == "L") globalOptions.logFeatures = true
	else if (flag === "g") {
		if (value) {
			if (value === "toml") {
				console.log(
					green(
						"Generated configuration file for type: 'toml' (default)",
					),
				)
				genConfig("toml")
			} else if (value === "env") {
				console.log(
					green("Generated configuration file for type: 'env'"),
				)
				genConfig("env")
			} else
				errorAndExit(
					`Unknown configuration type for flag 'g': ${value}`,
				)
		} else {
			console.log(
				green(
					"Generated configuration file for type: 'toml' (default)",
				),
			)
			genConfig("toml")
		}
	} else if (flag == "c") {
		if (value && /^\d+$/.test(value + "")) globalOptions.cacheTime = +value
		else flagError(`Flag 'c' exept not a number parameter`)
	} else if (flag == "l") {
	} else flagError(`Unknown flag: '${flag}'`)
}

export function setLongFlag<F extends FlagLong, V extends GetFlagProp<F>>(
	flag: F,
	value: V,
): void
export function setLongFlag<F extends FlagLongNoRequire>(flag: F): void
export function setLongFlag<F extends FlagLong, V extends GetFlagProp<F>>(
	flag: F,
	value?: V,
): void {
	if (flag == "quiet") globalOptions.quiet = true
	else if (flag == "no-cache") globalOptions.cache = false
	else if (flag == "no-avatars") globalOptions.avatars = false
	else if (flag == "log-features") globalOptions.logFeatures = true
	else if (flag === "gen-config") {
		if (value) {
			if (value === "toml") {
				console.log(
					green(
						"Generated configuration file for type: 'toml' (default)",
					),
				)
				genConfig("toml")
			} else if (value === "env") {
				console.log(
					green("Generated configuration file for type: 'env'"),
				)
				genConfig("env")
			} else
				errorAndExit(
					`Unknown configuration type for flag 'g': ${value}`,
				)
		} else {
			console.log(
				green(
					"Generated configuration file for type: 'toml' (default)",
				),
			)
			genConfig("toml")
		}
	} else if (flag == "cache-time") {
		if (value && /^\d+$/.test(value + "")) globalOptions.cacheTime = +value
		else flagError(`Flag 'c' exept not a number parameter`)
	} else flagError(`Unknown flag: '${flag}'`)
}
export function errorFlagWithNoProp(flag: Flag) {
	errorAndExit(
		`Flag '${flag}' must be used with a value, but it was used without it. ${readHelpPage}`,
	)
}

export function flagError(text: string) {
	errorAndExit(`${text}. ${readHelpPage}`)
}

export function errorFlagGotNoParams(flag: Flag) {
	flagError(
		`Expected parameter for flag '${flag}', but argument was not provided`,
	)
}

export function processFlags(flags: string[]) {
	var context: FlagContext | "" = ""
	for (var value of flags) {
		if (/^-\w{2,}$/.test(value)) {
			console.log(`Flags list: ${value}`)
			// short flag list
			for (var flagShort of [
				...value.slice(1),
			] as UnionToTuple<FlagShort>) {
				if (
					shortFlagsRequireOrExit.includes(
						flagShort as TupleToUnion<
							typeof shortFlagsRequireOrExit
						>,
					)
				) {
					if (flagShort === "l") errorFlagWithNoProp("l")
					if (flagShort === "c") errorFlagWithNoProp("c")
					else if (flagShort === "v") {
						console.log(globalOptions.version)
						process.exit()
					} else if (flagShort === "h") {
						import("./help").then((m) => m.default())
					}
				} else if (
					!shortFlagsRequireOrExit.includes(
						flagShort as TupleToUnion<
							typeof shortFlagsRequireOrExit
						>,
					)
				)
					setShortFlag(flagShort as FlagShortNoRequire)
				else if (flagShort === "g")
					setShortFlag("g" as FlagShortNoRequire)
				else if (!allFlagsShort.includes(flagShort))
					flagError(`No such flag as '${flagShort}'`)
				else console.error(`Unhandled flag: ${flagShort}`)
			}
		} else if (/^-\w$/.test(value)) {
			// each short flag by itself
			value = value.slice(1) as Flag
			if (context !== "") {
				if (context === "log")
					flagError(
						`Expected a value for flag 'l', but next flag was passed`,
					)
				else if (context === "cache-time")
					flagError(
						`Expected a value for flag 'c', but next flag was passed`,
					)
				else if (context === "gen-config") {
					console.log(
						green(
							"Generated configuration file for type: 'toml' (default)",
						),
					)
					genConfig("toml")
				}
			} else if (value) {
				if (value === "h") printHelp()
				else if (value === "v") {
					console.log(globalOptions.version)
					process.exit()
				} else if (value === "l") context = "log"
				else if (value === "c") context = "cache-time"
				else setShortFlag(value as FlagShortNoRequire)
			}
		} else if (/^--[\w\-]+$/.test(value)) {
			if (value === "log") context = "log"
			else setLongFlag(value as FlagLongNoRequire)
		} else if (value !== "") {
			if (context === "log") {
				setLogOption(value as LogOption)
			} else if (context === "cache-time") setShortFlag("c", +value)
		}
	}
	if (context) {
		if (context === "cache-time") errorFlagGotNoParams("c")
		else if (context === "log") errorFlagGotNoParams("l")
	}
}

function iNumber(obj: unknown): obj is number {
	return typeof obj === "number" && !isNaN(obj) && Number.isFinite(obj)
}
function isBoolean(obj: unknown): obj is boolean {
	return typeof obj === "boolean"
}

function getConfig() {
	var config: "config.toml" | ".env" | undefined,
		files = fs.readdirSync( "../")
	if (files.includes("config.toml")) config = "config.toml"
	else if (files.includes(".env")) config = ".env"
	else config = undefined

	if (config === "config.toml") {
		Bun.file(`./../${config}`).text().then(text => TOML.parse(text)).then(parseToml)
	}
}


function parseToml(obj: Record<string, any>) {
for (var [key, value] of Object.entries(obj as TOMLConfig)) {
	if (key === "cache_time")


}

}
