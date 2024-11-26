fileNotForRunning()

import { stdin, stdout } from "process"
import type { Context, MiddlewareHandler } from "hono"
import fs from "fs"
import { join } from "path"
import type {
	AlwaysResolvingPromise,
	ANSIRGB,
	ChechValidParamsParam,
	GetLogOption,
	GlobalOptions,
	LogDependency,
	LogLevel,
	LogOptionLong,
	LogOptionLongCombination,
	LogOptionShort,
	LogStringOne,
} from "./types"
import {
	getGlobalOption,
	getLogOption,
	setState,
	ROOT_PATH,
	logLevel,
	resetGlobalOptionsHandler,
	setGlobalConfigOption,
	getGlobalConfigOption,
} from "./config"
import { TOML } from "bun"
import { parseToml } from "./parseConfigFile"
import { cache } from "./db"

export var info = customLogTag("Info", cyan),
	error = customLogTag("Error", red),
	warning = customLogTag("Warning", yellow),
	/** NC = No Color ANSI escape code */
	NC = "\u001b[0m" as const,
	compress = Bun.deflateSync,
	decompress = Bun.inflateSync

/** Call this function at the top of the file if you don't want this file to be run directly */
export function fileNotForRunning() {
	var file = process.argv[1].match(/[a-zA-Z0-9_\-]+\.ts$/)?.[0]
	if (file && (file === "index.ts" || file === "help.ts" || file === "explain.ts")) return
	else
		import("./config").then(() => {
			console.log(
				error(
					`File ${green(`./src/${file}`)} is a library file and is not intended to be run directly`,
				),
			)
			process.exit()
		})
}

export function customLogTag<S extends string, C extends ANSIRGB>(
	tag: S,
	ansi: C,
): (arg: any) => string
export function customLogTag<S extends string, C extends (text: any) => string>(
	tag: S,
	colorFn: C,
): (arg: any) => string
export function customLogTag<S extends string>(tag: S): (arg: any) => string
export function customLogTag<S extends string, C extends ANSIRGB | ((text: any) => string)>(
	tag: S,
	ansi_colorFn?: C,
) {
	/** Formats the input string with following format: `"[timestamp (optional)][tag name] ${text}"`
	 * @returns {string} Information with the tag, and optional formated timestamp (if cooresponding options are turned on) in formt of `"[timestamp][Tag name] {text}"` */
	return function color(arg: any): string {
		var result = "",
			timestamps = memoize(getGlobalOption<"timestamps">, "timestamps"),
			date = memoize(formatDate)

		if (typeof ansi_colorFn === "string")
			result = `\x1b[${ansi_colorFn}m${timestamps.value ? `[${date.value}]` : ""}[${tag}]${NC}`
		else {
			result = `${timestamps.value ? `[${date.value}]` : ""}[${tag}]`
			if (typeof ansi_colorFn === "function") result = ansi_colorFn(result)
		}

		result += ` ${arg}`
		return result
	}
}

export function RGBToANSI<
	R extends number = number,
	G extends number = number,
	B extends number = number,
>(rgb: readonly [R, G, B] | [R, G, B]): ANSIRGB<R, G, B> {
	return `38;2;${rgb[0]};${rgb[1]};${rgb[2]}`
}

export function yellow(text: any) {
	return `\x1b[33m${text}\x1b[0m`
}
export function red(text: any) {
	return `\x1b[31m${text}\x1b[0m`
}
export function green(text: any) {
	return `\x1b[32m${text}\x1b[0m`
}

export function cyan(text: any) {
	return `\x1b[36m${text}\x1b[0m`
}

export function purple(text: any) {
	return `\x1b[35m${text}\x1b[0m`
}

export function EXIT(isInBuffer = false) {
	isInBuffer && exitAlternateBuffer()
	process.exit()
}

/** Sets the terminal raw mode to `enabled`, enters the alternate buffer, and returns a cleanup function that sets the terminal raw mode to `disabled`, and exits the alternate buffer */
export function enterAlternateBuffer() {
	var command = ""
	if (stdin.isTTY) {
		try {
			stdin.setRawMode(true)
		} catch (e) {
			console.error("Failed to set raw mode:", e)
			process.exit()
		}
	}
	try {
		// enter alternate buffer, and move cursor to the left-top position
		stdout.write("\x1b[?1049h\x1b[H")
	} catch (e) {
		console.error("Failed to enter alternate buffer:", e)
		process.exit()
	}
	/** Listen to a specific command or a sequense of characters to exit */
	var listener = (buffer: Buffer) => {
		console.log(`Buffer: ${buffer.join(", ")}`)
		// <Ctrl> + c => SIGINT (interupt)
		if (buffer.length === 1 && buffer[0] === 0x03) EXIT(true)
		// <Ctrl> + z => SIGTSTP (send to background)
		else if (buffer.length === 1 && buffer[0] === 0x1a) {
			exitAlternateBuffer()
			process.kill(process.pid, "SIGTSTP")
		} else {
			var str = buffer.toString().trim()
			if (str === "q") EXIT(true)
			else if ((str === ":" || str === "Z") && command === "") command = str
			else if ((str === "q" || str === "x") && command === ":") EXIT(true)
			else if (str === "Z" && command === "Z") EXIT(true)
			else if (command !== "") command = ""
		}
	}
	stdin.on("data", listener)
	return () => {
		stdin.removeListener("data", listener)
		exitAlternateBuffer()
	}
}

/** Safely exit alternate buffer
 * Use ONLY if there are no other ways! Preferable to use the cleanup function from `enterAlternateBuffer` function to not mess up with them */
export function exitAlternateBuffer() {
	if (stdin.isTTY) {
		try {
			stdin.setRawMode(false)
		} catch (e) {
			console.error("Failed to exit raw mode:", e)
			process.exit()
		}
	}
	try {
		stdout.write("\x1b[?1049l")
	} catch (e) {
		console.error("Failed to exit alternate buffer:", e)
		process.exit()
	}
}

export function formatDelta<T extends number, A extends boolean = false>(
	timestamp: T,
	accurate = false as A,
) {
	var time = timestamp < 1000 ? timestamp : timestamp / 1000
	return accurate ? +time.toFixed(3) : Math.trunc(time)
}

export function formatDeltaValue<T extends number>(delta: T) {
	var result = formatDelta(delta, getGlobalOption("accurateTime"))
	return `${result}${delta < 1000 ? "ms" : "s"}`
}
export function logger(fn: (message: string) => void = console.log): MiddlewareHandler {
	return async (c, next) => {
		var { method } = c.req,
			path = decodeURIComponent(c.req.url.match(/^https?:\/\/[^/]+(\/[^\?#]*)/)?.[1] ?? "/"),
			start = performance.now(),
			timestamps = memoize(getGlobalOption<"timestamps">, "timestamps"),
			date = memoize(formatDate)

		// incoming request
		fn(
			`${timestamps.value ? `${green(`[${date.override}]`)} ` : ""}${green("<--")} ${method} ${path}`,
		)

		return new Promise((resolve) => {
			next().then(() => {
				var status = c.res.status,
					end = performance.now(),
					elapsed = end - start,
					statuscategory = Math.floor(status / 100) || 0,
					colorFn: (text: any) => string
				if (statuscategory === 7) colorFn = purple
				else if (statuscategory === 5) colorFn = red
				else if (statuscategory === 3) colorFn = cyan
				else if (statuscategory === 4 || statuscategory === 0) colorFn = yellow
				else if (statuscategory === 1 || statuscategory === 2) colorFn = green
				else colorFn = yellow

				// outgoing response
				fn(
					`${timestamps.value ? `${green(`[${date.override}]`)} ` : ""}${colorFn("-->")} ${method} ${path} ${colorFn(status)} ${formatDeltaValue(elapsed)}`,
				)
				resolve()
			})
		})
	}
}

export function chechCache() {
	var cacheType = getGlobalOption("cacheType"),
		toBeDeleted = 0,
		// if `cacheType` === "both", then do an extra check on if cache
		// in code and cache in filesystem are the same,
		// otherwise complete the missing one from the corresponding type
		toBeRepaired = 0
	new Promise((resolve) => {
		var waiting: Promise<void>[] = []
		if (cacheType === "code") {
			var hashes = cache.gif.code.hashes
			for (var hash of hashes) {
				if (cache.gif.code.checkCacheTime(hash)) {
					cache.gif.code.remove(hash)
					toBeDeleted++
				}
			}
		} else if (cacheType === "fs") {
		} else {
		}

		Promise.all(waiting).then(resolve)
	}).then(() => {
		if (toBeDeleted) log("cache", info(`Found ${toBeDeleted} outdated GIFs in cache`))
		if (toBeRepaired) log("cache", info(`Repaired ${toBeRepaired} GIFs`))
	})
}

/** Checks if given cache type is the current type. If current === `"both"` - return true, else compare */
export function isCurrentCacheType<T extends GlobalOptions["cacheType"]["value"]>(type: T) {
	var ct = getGlobalOption("cacheType")
	return ct === "both" ? true : ct === type
}

export function isLogfeatureEnabled(feature: LogOptionLong) {
	return getLogOption(feature) ?? false
}

/** Accepts a log option, and normalizes it to the expanded long option (see `logLevel` in `./src/config.ts:105`)
 * if option is string - tries to return it's full version, or undefined if not Found
 * if option is number - tries to access the `logLevel` by this index -1, or undefined if not found */
export function normalizeLogOption<O extends LogOptionShort | LogOptionLong | LogLevel>(
	option: O,
): GetLogOption<O> {
	return (
		typeof option === "number"
			? option < 6 && option > 0
				? logLevel[--option]
				: undefined
			: logLevel.find((e) => e[0] === option || e === option)
	) as GetLogOption<O>
}

/** Log things on different events in form of dependencies
 * `"info"` event works any time unless `quiet` global option is set
 * `"warning"` event trigers if `warnings` global option is set
 * `"error"` event trigers if `errors` global option is set
 * `LogLevel` event trigers if aproparate level of logging is set (maximum, see )
 * `LogOptionLongCombination` event trigers if one of log options listed in combination is set
 */
export function log<D extends LogOptionLongCombination>(dependencies: D, ...args: any[]): void
export function log<D extends LogDependency>(dependency: D, ...args: any[]): void
export function log<D extends LogDependency>(dependency: D, ...args: any[]) {
	var doLog = false
	if (!getGlobalOption("quiet")) {
		if (dependency === "info") doLog = true
		else if (dependency === "error") getGlobalOption("errors") && (doLog = true)
		else if (dependency === "warning") getGlobalOption("warnings") && (doLog = true)
		else if (typeof dependency === "number") {
		} else if (typeof dependency === "string") {
			if (dependency.includes(",")) {
				var deps = dependency.split(/,/g) as LogStringOne[]
				for (var dep of deps) {
					var opt = normalizeLogOption(dep)

					if (opt && getLogOption(opt)) {
						doLog = true
						break
					}
				}
			} else if (getLogOption(normalizeLogOption(dependency as LogStringOne))) doLog = true
		}
		doLog && console.log(...args)
	}
}

/** Formats the date with the given format string. Formating characters:
 *
 * | format | description                                    |
 * |:------:|:-----------------------------------------------|
 * |   u    | microseconds                                   |
 * |   S    | milliseconds                                   |
 * |   s    | seconds                                        |
 * |   m    | minutes                                        |
 * |   h    | hours (24h format, 12:00, 13:00, 24:00, 01:00) |
 * |   H    | hours (12h format, 12 PM,  1 PM, 12 AM,  1 AM) |
 * |   P    | `AM`/`PM` indicator                                |
 * |   d    | day (first 3 letters of the day of the week)   |
 * |   D    | day (of month)                                 |
 * |   M    | month (number)                                 |
 * |   N    | month (3 first letters of the month name)      |
 * |   Y    | year                                           |
 *
 * _Note!_ To escape some character that are listed in formating - use backslash symbol `\` before character (you would probably need second one, to escape the escape character like `\n`, `\t` or others depending on where you write the format).
 * _Note!_ `microseconds` are obtained with the high precision time in milliseconds from the script start time, which has a part after period, that indicates microseconds. So it's probably not syncronized with the computer's clock time, but it can be used as a timestamp in the time.
 * *Examples*:
 * | format        | description                                                                                             |
 * |:--------------|:--------------------------------------------------------------------------------------------------------|
 * | "s:m:h D.M.Y" | `seconds:minutes:hours day(of month).month(number).year`                                                  |
 * | "Y N d m:h"   | `year month(3 first letters of the month name) day(first 3 letters of the day of the week) minutes:hours` |
 * | "m:s:S.u"     | `minutes:seconds:milliseconds.microseconds`                                                               |
 * | "s/m/h"       | `seconds/minutes/hours`                                                                                   |
 * | "m:h"         | `minutes:hours`                                                                                           |
 *
 * @returns formated string with substituted values from the date
 */
export function formatDate<F extends string>(
	date: Date = new Date(),
	format = getGlobalOption("timestampFormat") as F,
) {
	var absolute = date.getTime() + (performance.now() % 1_000)
	return (
		format
			// Microseconds
			.replace(
				/(?<!\\)u/g,
				String(Math.round((absolute - Math.floor(absolute)) * 1_000)).padStart(3, "0"),
			)
			// milliseconds
			.replace(/(?<!\\)S/g, String(date.getMilliseconds()).padStart(3, "0"))
			// seconds
			.replace(/(?<!\\)s/g, String(date.getSeconds()).padStart(2, "0"))
			// Minutes
			.replace(/(?<!\\)m/g, String(date.getMinutes()).padStart(2, "0"))
			// 24-hour format
			.replace(/(?<!\\)h/g, String(date.getHours()).padStart(2, "0"))
			// 12-hour format
			.replace(/(?<!\\)H/g, String(date.getHours() % 12 || 12))
			// Day of month
			.replace(/(?<!\\)D/g, String(date.getDate()).padStart(2, "0"))
			// Month (number)
			.replace(/(?<!\\)M/g, String(date.getMonth() + 1).padStart(2, "0"))
			// Day of week (3-letter)
			.replace(/(?<!\\)d/g, date.toLocaleString("en", { weekday: "short" }))
			// Month (3-letter name)
			.replace(/(?<!\\)N/g, date.toLocaleString("en", { month: "short" }))
			// Year
			.replace(/(?<!\\)Y/g, String(date.getFullYear()))
			// AM/PM indicator
			.replace(/(?<!\\)P/g, date.getHours() >= 12 ? "PM" : "AM")
			// Removing all leading `\` for escaping characters
			.replace(/\\(?=\S)/g, "")
	)
}

/** Returns `true` if at least one argument is nullable (`undefined`|`null`) */
export function hasNullable(...args: unknown[]) {
	return args.some((e) => e === undefined || e === null)
}

/** Memoize the function and arguments to it, and return an interactive object to interactive get certain properties from it
 * @field value     - call the function for the first time, store result in cache, and on eacn access - return a cached result (`override` getter overrides the cached value)
 * @field call      - call the function with given parameters, and return a value, not overriding the cache
 * @field override  - call the function with arguments, override the value in cache, and return the value
 * @field fn        - the given function
 * @field args      - the given arguments */
export function memoize<T, P extends any[]>(fn: (...args: P) => T, ...args: P) {
	var result: T,
		hasResult = false
	return {
		/** call the function for the first time, store result in cache, and on eacn access - return a cached result (`override` getter overrides the cached value) */
		get value() {
			if (!hasResult) {
				result = fn(...args)
				hasResult = true
			}
			return result
		},
		/** call the function with given parameters, and return a value, not overriding the cache */
		get call() {
			return fn(...args)
		},
		/** call the function with arguments, override the value in cache, and return the value */
		get override() {
			result = fn(...args)
			hasResult ||= true
			return result
		},
		/** the given function */
		get fn() {
			return fn
		},
		/** the given arguments */
		get args() {
			return args
		},
	}
}

export function checkValidRequestParams(
	c: Context,
	{ size, shift, resize, fps, squeeze }: ChechValidParamsParam,
) {
	var badRequest = (message: string) =>
		c.json(
			{
				ok: false as const,
				code: 400 as const,
				message,
				statusText: "Bad Request" as const,
			},
			{ status: 400 as const },
		)

	if (size && !/^\d+$/.test(size))
		return badRequest("Invalid size parameter. Usage: '{Integer}'. Ex: '20', '90'")
	if (size && /^\d+$/.test(size) && +size < 1)
		return badRequest("Size parameter out of range. Use only positive values [1, +Infinity)")
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
			"Invalid shift parameter value. Use only integers in range (-Infinity, +Infinity)",
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
			"Invalid resize parameter value. Use only integers in range (-Infinity, +Infinity)",
		)
	if (fps && !/^\d?\d$/.test(fps))
		return badRequest(
			"Invalid fps parameter. Usage: '{Integer}'. Ex: '10', '14' Please take notice about gif frame rate compatiability. Read 'https://www.fileformat.info/format/gif/egff.htm' for more information",
		)
	if (fps && /^\d?\d$/.test(fps) && (+fps < 1 || +fps > 50))
		return badRequest(
			"Invalid fps parameter value. Use only integers in range [1, 50] (recomended). Please take notice about gif frame rate compatiability. Read 'https://www.fileformat.info/format/gif/egff.htm' for more information",
		)
	if (squeeze && !/^-?\d+$/.test(squeeze))
		return badRequest("Invalid squeeze parameter. Usage: '{Integer}'. Ex: '10', '-20'")
	if (squeeze && /^-?\d+$/.test(squeeze) && isNaN(+squeeze))
		return badRequest("Invalid squeeze parameter value. Use only integers")
}

export function updateObject<T extends Record<any, any>>(original: T, source: T) {
	for (var key in source) if (Object.hasOwn(original, key)) original[key] = source[key]
}

export function isString(obj: unknown): obj is string {
	return typeof obj === "string"
}

export function isNumber(obj: unknown): obj is number {
	return typeof obj === "number" && !isNaN(obj) && Number.isFinite(obj)
}
export function isStringNumber(obj: unknown): obj is `${number}` {
	return typeof obj === "string" && /^-?\d+$/.test(obj) && isNumber(+obj)
}

export function isBoolean(obj: unknown): obj is boolean {
	return typeof obj === "boolean"
}
export function isStringBoolean(obj: unknown): obj is `${boolean}` {
	return typeof obj === "string" && /^(true|false)$/.test(obj)
}
export function isStringTrueBoolean(obj: `${boolean}`): obj is "true" {
	return typeof obj === "string" && /^true$/.test(obj)
}

export function hasConfigFile() {
	return getGlobalConfigOption("useConfig") && fs.readdirSync(ROOT_PATH).includes("config.toml")
}

/** Try to get the config file, and try to parse it
 * if everything went good - resolve `true`. If there was an error - resolve `false`. If config doesn't exist - resolve `true`  */
export function getConfig(reload = false): AlwaysResolvingPromise<boolean> {
	setState("configuring")
	reload && resetGlobalOptionsHandler(false)
	return new Promise<boolean>((resolve) => {
		if (hasConfigFile())
			Bun.file(join(ROOT_PATH, "config.toml"))
				.text()
				.then(TOML.parse)
				.then(parseToml)
				.then(
					() => {
						setGlobalConfigOption("config", true)
						setState("ready")
						resolve(true)
					},
					(e) => {
						verboseError(
							e,
							error("Error while parsing toml configuration file:\n"),
							error("Error while parsing toml configuration file"),
						)
						setGlobalConfigOption("config", false)
						setState("ready")
						resolve(false)
					},
				)
		else {
			setGlobalConfigOption("config", false)
			setState("ready")
			resolve(true)
		}
	})
}

export function sameType(value1: unknown, value2: unknown) {
	return typeof value1 === typeof value2
}

/** Log the error message, and if `verboseErrors` global option is enabled - log first message. Else second */
export function verboseError(error: Error, onError: any, offError: any) {
	if (getGlobalOption("verboseErrors")) log("error", onError, error)
	else log("error", offError)
}

export function parseLogOption(
	option: string,
): -1 | LogOptionLong[] | { duplicate: LogOptionLong } | { notFound: string } {
	var result: LogOptionLong[] = []
	if (isStringNumber(option)) {
		var level = +option
		if (level < 0 || level > 6) return -1
		for (; level > 0; level--) {
			var o = normalizeLogOption(level as LogLevel)
			if (o !== undefined) result.push(o)
		}
	} else {
		if (option.match(/,/)) {
			var options = option.split(/,/g) as (LogOptionLong | LogOptionShort)[]
			for (var opt of options) {
				var final = normalizeLogOption(opt)
				if (result.includes(final)) return { duplicate: final }
				else result.push(final)
			}
		} else {
			var r = normalizeLogOption(option as LogOptionShort | LogOptionLong)
			if (r === undefined) return { notFound: option }
			result.push(r)
		}
	}
	return result
}
