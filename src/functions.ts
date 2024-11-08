fileNotForRunning()

import type { Context } from "hono"
import fs from "node:fs"
import { join } from "path"
import type {
	AllGlobalConfigOptions,
	AlwaysResolvingPromise,
	ANSIRGB,
	ChechValidParamsParam,
	FilterObjectProps,
	GlobalOptionPropPriorityAll,
	LogLevel,
	LogOption,
	LogOptionLong,
	LogOptions,
	LogOptionShort,
	LogStringOne,
} from "./types"
import {
	getGlobalOption,
	getLogOption,
	normalizePriority,
	getPriorityForOption,
	priorityLevel,
	setState,
	ROOT_PATH,
	logLevel,
} from "./config"
import zlib from "zlib"
import { TOML } from "bun"
import { parseEnv, parseToml } from "./parseConfigFile"

var lightblue = [0, 170, 210] as const

export function fileNotForRunning() {
	var file = process.argv[1].match(/[a-zA-Z0-9_\-]+\.ts$/)?.[0]
	if (file && (file === "index.ts" || file === "help.ts")) return
	else {
		console.log(
			error(
				`File ${green(`@/src/${file}`)} is a library file and is not intended to be run directly`,
			),
		)
		process.exit()
	}
}

export function customLogTag<S extends string, C extends ANSIRGB>(
	tag: S,
	color?: C,
) {
	return function (string: any) {
		return (
			`${color ? `\x1b[${color}m` : ""}${getGlobalOption("timestamps") ? `[${formatDate(new Date(), getGlobalOption("timestampFormat"))}]` : ""}[${tag}]${color ? "\x1b[0m" : ""} ` +
			string
		)
	}
}

export function RGBToANSI<
	R extends number = number,
	G extends number = number,
	B extends number = number,
>(rgb: readonly [R, G, B] | [R, G, B]): ANSIRGB<R, G, B> {
	return `38;2;${rgb[0]};${rgb[1]};${rgb[2]}`
}

export var info = customLogTag("Info", RGBToANSI(lightblue))

export function yellow(text: any) {
	return `\x1b[33m${text}\x1b[0m`
}
export function red(text: any) {
	return `\x1b[31m${text}\x1b[0m`
}
export function green(text: any) {
	return `\x1b[32m${text}\x1b[0m`
}
export function isLogfeatureEnabled(feature: LogOptionLong) {
	return getLogOption(feature) ?? false
}
type GetLogOption<O extends LogOptionShort | LogOptionLong | LogLevel> =
	O extends LogLevel
		? (typeof logLevel)[O]
		: O extends LogOptionShort
			? {
					[K in keyof LogOptions]: K extends `${O}${string}`
						? K
						: never
				}[keyof LogOptions]
			: O extends LogOptionLong
				? O
				: never

function normalizeLogOption<
	O extends LogOptionShort | LogOptionLong | LogLevel,
>(option: O): GetLogOption<O> {
	return (
		typeof option === "number"
			? option < 6 && option > -1
				? logLevel[option]
				: "rest"
			: (logLevel.find((e) => e[0] === option || e === option) ?? "rest")
	) as GetLogOption<O>
}

type LogDependency = "info" | "error" | "warning" | LogOption

/** Log things on different events in form of dependencies */
export function log<D extends LogDependency>(dependency: D, ...args: any[]) {
	var doLog = false
	if (!getGlobalOption("quiet")) doLog = true
	else if (dependency === "info") doLog = true
	else if (dependency === "error") getGlobalOption("errors") && (doLog = true)
	else if (dependency === "warning")
		getGlobalOption("warnings") && (doLog = true)
	else if (typeof dependency === "number") {
	} else if (typeof dependency === "string") {
		if (dependency.includes(",")) {
			var deps = dependency.split(/,/g) as LogStringOne[]
			for (var dep of deps)
				if (getLogOption(normalizeLogOption(dep))) {
					doLog = true
					break
				}
		} else if (getLogOption(normalizeLogOption(dependency as LogStringOne)))
			doLog = true
	}
	doLog && console.log(...args)
}

/** Formats the input date with a given format:
 * `S` = milliseconds (from last second)
 * `s` = seconds (from last minute)
 * `m` = minutes (from last hour)
 * `h` = hours (24h format, 12:00, 13:00, 24:00, 01:00)
 * `H` = hours (12h format, 12 PM,  1 PM, 12 AM,  1 AM)
 * `P` = `AM`/`PM` indicator
 * `d` = day (of week)
 * `D` = day (of month)
 * `M` = month (number)
 * `N` = month (3 first letters of the month name)
 * `Y` = year
 *
 * *Examples*:
 * "s:m:h D.M.Y" = "seconds:minutes:hours days_in_the_month.month(number).year"
 * "Y N d m:h" = "year month(3 first letters of name) day(of week) minutes:hours"
 * "s/m/h" = "seconds/minutes/hours"
 * "m:h" = "minutes:hours"
 *
 * @returns Formated date as a string
 */
function formatDate<F extends string>(date: Date, format: F) {
	return (
		format
			// milliseconds
			.replace(
				/(?<!\\)S/g,
				String(date.getMilliseconds()).padStart(3, "0"),
			)
			// seconds
			.replace(/(?<!\\)s/g, String(date.getSeconds()).padStart(2, "0"))
			// Minutes
			.replace(/(?<!\\)m/g, String(date.getMinutes()).padStart(2, "0"))
			// 24-hour format
			.replace(/(?<!\\)h/g, String(date.getHours()).padStart(2, "0"))
			// 12-hour format
			.replace(
				/(?<!\\)H/g,
				String(date.getHours() % 12 || 12).padStart(2, "0"),
			)
			// Day of week (3-letter)
			.replace(
				/(?<!\\)d/g,
				date.toLocaleString("en", { weekday: "short" }),
			)
			// Day of month
			.replace(/(?<!\\)D/g, String(date.getDate()).padStart(2, "0"))
			// Month (number)
			.replace(/(?<!\\)M/g, String(date.getMonth() + 1).padStart(2, "0"))
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

export function warning(text: string) {
	return `${yellow(`${getGlobalOption("timestamps") ? `[${formatDate(new Date(), getGlobalOption("timestampFormat"))}]` : ""}[Warning]`)} ${text}`
}

export function error(text: string) {
	return `${red(
		`${
			getGlobalOption("timestamps")
				? `[${formatDate(
						new Date(),
						getGlobalOption("timestampFormat"),
					)}]`
				: ""
		}[Error]`,
	)} ${text}`
}

/** Returns `true` if at least one argument is nullable (`undefined`|`null`) */
export function hasNullable(...args: unknown[]) {
	return args.some((e) => e === undefined || e === null)
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

export function checkPermisionForGlobalOption<
	O extends keyof FilterObjectProps<
		AllGlobalConfigOptions,
		string | number | boolean
	>,
	P extends GlobalOptionPropPriorityAll,
>(option: O, priority: P) {
	return (
		priorityLevel.indexOf(getPriorityForOption(option)) <
		normalizePriority(priority)
	)
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
	if (size && !/^\d+$/.test(size))
		return badRequest(
			"Invalid size parameter. Usage: '{Integer}'. Ex: '20', '90'",
		)
	if (size && /^\d+$/.test(size) && +size < 1)
		return badRequest(
			"Size parameter out of range. Use only positive values [1, +Infinity)",
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
	if (fps && /^\d?\d$/.test(fps) && +fps < 1)
		return badRequest(
			"Invalid fps parameter value. Use only integers in range [1, 50] (recomended). Please take notice about gif frame rate compatiability. Read 'https://www.fileformat.info/format/gif/egff.htm' for more information",
		)
	if (squeeze && !/^-?\d+$/.test(squeeze))
		return badRequest(
			"Invalid squeeze parameter. Usage: '{Integer}'. Ex: '10', '-20'",
		)
	if (squeeze && /^\d+$/.test(squeeze) && isNaN(+squeeze))
		return badRequest("Invalid squeeze parameter value. Use only integers")
}

export function updateObject<T extends Record<any, any>>(
	original: T,
	source: T,
) {
	for (var key in source)
		if (Object.hasOwn(original, key)) original[key] = source[key]
}

export function compress(buffer: Buffer) {
	return zlib.brotliCompressSync(new Uint8Array(buffer))
}

export function decompress(buffer: Buffer) {
	return zlib.brotliDecompressSync(new Uint8Array(buffer))
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
export function checkForTrueString(obj: `${boolean}`): obj is "true" {
	return typeof obj === "string" && /^true$/.test(obj)
}

export function getConfigType() {
	var type: "config.toml" | ".env" | undefined,
		files = fs.readdirSync(ROOT_PATH)
	if (files.includes("config.toml")) type = "config.toml"
	else if (files.includes(".env")) type = ".env"
	else type = undefined

	return type
}

export function getConfig<R extends boolean = false>(
	reload?: R,
): AlwaysResolvingPromise<boolean> {
	setState("configuring")
	var config = getConfigType()
	return new Promise<boolean>((resolve) => {
		if (config === "config.toml") {
			Bun.file(join(ROOT_PATH, config))
				.text()
				.then(TOML.parse)
				.then(parseToml)
				.then(() => {
					setState("ready")
					resolve(true)
				})
				.catch((e) => {
					console.error(
						"Error while parsing toml configuration file:\n",
						e,
					)
					resolve(false)
				})
		} else if (config === ".env") {
			parseEnv()
			setState("ready")
			resolve(true)
		} else setState("ready"), resolve(true)
	})
}

export function sameType(value1: unknown, value2: unknown) {
	return typeof value1 === typeof value2
}
