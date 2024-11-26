fileNotForRunning()

import {
	error,
	fileNotForRunning,
	formatDate,
	green,
	isStringNumber,
	memoize,
	normalizeLogOption,
	parseLogOption,
} from "./functions"
import {
	getGlobalOption,
	getServerOption,
	getVersion,
	globalOptionsDefault,
	logGlobalOptions,
	setGlobalConfigOption,
	setGlobalOption,
	setLogOption,
	setServerOption,
	setState,
} from "./config"
import printHelp, { helpFlags, ss } from "./help"
import type { Flag, FlagValueArray, FlagValueUnion, LogLevel } from "./types"
import { genConfig } from "./genConfig"

var flagRegex = /^-([a-zA-Z]|-[a-z\-]+)$/,
	readHelpPage =
		`Run '${green("bun run help")}' or '${green("bun start -h")}' to read the help page to see the correct flag usage` as const,
	isFlagError = false,
	isError = false,
	exit = false,
	printMsg = "",
	errorMsg = "",
	flagErrors = {
		noProp(flag: string, args?: string | string[] | readonly string[]) {
			errorLog(
				`Expected argument for flag '${green(flag)}', but argument was not provided${formatParamsForError(args)}`,
			)
			isFlagError ||= true
		},
		nextFlag(flag: string) {
			errorLog(`Expected argument for flag '${green(flag)}', but next flag was passed`)

			isFlagError ||= true
		},
		notRecognized(flag: string) {
			errorLog(`Flag '${green(flag)}' is not recognized as valid`)
			isFlagError ||= true
		},
		incorrectParametersOrder(flag: string, values: FlagValueArray) {
			errorLog(
				`The parameters of the flag '${green(flag)}' must comply with the ideology: "required" -> "optional". Found: '${values}'`,
			)
			isFlagError ||= true
		},
		wrongValueType(flag: string) {
			errorLog(
				`Type of 'value' property on flag '${green(flag)}' is not compatitable with expected type. Consider reading '${green("./src/types")}' file under the '${green("Flag<T extends FlagValueUnion>")}' type`,
			)
			isFlagError ||= true
		},
	}

/** dv = Default Value, for sure
 * returns `(default=${value})` string with space around equality sign depending on screen size
 */
function dv(value: any) {
	return `(default${ss("", " ")}=${ss("", " ")}${value})`
}

function formatParamsForError(args?: string | string[] | readonly string[]) {
	var result = ""

	if (args !== undefined) {
		if (Array.isArray(args)) result = `. Arguments: ${args.map(green).join(" ")}`
		else result = `. Argument: ${green(args)}`
	}

	return result
}

export var flags: Map<string, Flag<FlagValueUnion>> = new Map(),
	flagObjects: Flag<FlagValueUnion>[] = [],
	addFlag = {
		empty(flag: Flag<"none">) {
			addFlagHandler(flag)
		},
		optional(flag: Flag<"optional">) {
			addFlagHandler(flag as Flag<FlagValueUnion>)
		},
		required(flag: Flag<"required">) {
			addFlagHandler(flag as Flag<FlagValueUnion>)
		},
		multipleParams<T extends FlagValueArray>(flag: Flag<T>) {
			addFlagHandler(flag as unknown as Flag<FlagValueUnion>)
		},
	}

function addFlagHandler(flag: Flag<FlagValueUnion>) {
	if (flag.short) flags.set(`-${flag.short}`, flag)
	flags.set(`--${flag.long}`, flag)
	flagObjects.push(flag)
}

export function setupFlagHandlers() {
	if (flags.size !== 0) return
	addFlag.optional({
		short: "h",
		long: "help",
		value: "optional",
		parameter: "[section]",
		description: `Display this help message (${green("bun run help")}) or a spesific section. See ${green("SECTIONS")}`,
		extendedDescription: `Display this help message (alias is also '${green("bun run help")}') or a spesific section. Available sections: ${helpFlags.map(green).join(ss(",", ", "))}`,
		handler(value) {
			addText(printHelp(value as (typeof helpFlags)[number]))
			exit = true
		},
	})

	addFlag.empty({
		short: "v",
		long: "version",
		value: "none",
		parameter: "",
		description: "Display version and exit",
		extendedDescription: `Display version and exit. Current version: ${green(getVersion())}`,
		handler() {
			console.log(getVersion())
			exit = true
		},
	})

	addFlag.empty({
		short: "q",
		long: "quiet",
		value: "none",
		parameter: "",
		description: "Run the server without any output",
		extendedDescription: `Run the server without any output, including all errors on startup ${dv(green(getGlobalOption("quiet")))}`,
		handler() {
			setGlobalOption("quiet", true, 2)
		},
	})

	addFlag.required({
		short: "l",
		long: "log",
		value: "required",
		parameter: "<level|feature...>",
		description: `Log level (0-5) or custom features to log. See ${green("LOG OPTIONS")}`,
		extendedDescription: `Log level (0-5) or custom features to log. See ${green("LOG OPTIONS")} section. (default values: ${Object.entries(
			globalOptionsDefault.logOptions,
		)
			.reduce<string[]>(
				(a, [k, v]) => (a.push(`${green(k)}${ss("", " ")}=${ss("", " ")}${green(v)}`), a),
				[],
			)
			.join(", ")})`,
		handler(value) {
			if (/^0$/.test(value)) {
				for (var i = 1; i < 6; i++)
					setLogOption(normalizeLogOption(i as LogLevel)!, false, 2)
			} else {
				var parsed = parseLogOption(value),
					seeLogOptions = memoize(
						addError,
						`Read '${green("log_options")}' help page section by running: ${green("bun run help log_options")}`,
					)
				if (Array.isArray(parsed)) {
					var options = value.split(/,/g)
					for (var [idx, val] of Object.entries(parsed)) {
						if (val === undefined) {
							errorLog(
								`Log option '${green(options[idx as unknown as number])}' is not recognized as valid`,
							)
							seeLogOptions.call
						}
					}
				} else if (typeof parsed === "object") {
					if ("duplicate" in parsed)
						errorLog(
							`Log option '${green(parsed.duplicate)}' appeared more than once. Why should you do that?`,
						)
					else
						errorLog(
							`Log option '${green(parsed.notFound)}' is not recognized as valid`,
						)
				} else if (parsed === -1) {
					errorLog(`Log level '${green(value)}' is not in the range: ${green("1-5")}`)
					seeLogOptions.call
				}
			}
		},
	})

	addFlag.empty({
		short: "L",
		long: "log-features",
		value: "none",
		parameter: "",
		description: "Log logging features on startup/restart",
		extendedDescription: `Log logging features on startup/restart ${dv(green(getGlobalOption("logFeatures")))}`,
		handler() {
			setGlobalOption("logFeatures", true, 2)
		},
	})

	addFlag.required({
		long: "cache-time",
		value: "required",
		parameter: "<ms>",
		description: `Cache time in miliseconds`,
		extendedDescription: `Cache time in miliseconds (default${ss("", " ")}=${ss("", " ")}${green(getGlobalOption("cacheTime"))}${ss("", " ")}ms, ${green(getGlobalOption("cacheTime") / 60_000)}${ss("", " ")}mins)`,
		handler(value) {
			if (isStringNumber(value)) setGlobalOption("cacheTime", +value, 2)
			else {
				errorLog(`Flag '${green("c")}' accepted a non-numeric parameter`)
				exit ||= true
			}
		},
	})

	addFlag.required({
		long: "cache-type",
		value: "required",
		parameter: "<code|fs|both>",
		description: `What kind of cache to use`,
		extendedDescription: `What kind of cache to use (read '${green("cache.md")}' file for more) ${dv(green(getGlobalOption("cacheType")))}`,
		handler(value) {
			errorLog(`Flag --cache-type is not implemented. Value is: '${value}'`)
			exit ||= true
		},
	})

	addFlag.required({
		short: "c",
		long: "cache",
		value: "required",
		parameter: "<y|yes|n|no>",
		description: "Enable permanent cache, or disable it completely",
		extendedDescription: `Enable permanent cache, or disable it completely. (default: cache${ss("", " ")}=${ss("", " ")}${green(getGlobalOption("cache"))}, permanentCache${ss("", " ")}=${ss("", " ")}${green(getGlobalOption("permanentCache"))})`,
		handler(value) {
			if (value.match(/y|yes/i)) setGlobalOption("permanentCache", true, 2)
			else if (value.match(/n|no/i)) setGlobalOption("cache", false, 2)
			else {
				errorLog(`Flag --cache accepts only following arguments: y, yes, n, no`)
				exit ||= true
			}
		},
	})

	addFlag.empty({
		short: "A",
		long: "no-avatars",
		value: "none",
		parameter: "",
		description: "Do not store avatars",
		extendedDescription: `Do not store avatars ${dv(green(getGlobalOption("avatars")))}`,
		handler() {
			setGlobalOption("avatars", false, 2)
		},
	})

	addFlag.empty({
		short: "W",
		long: "no-warnings",
		value: "none",
		parameter: "",
		description: "Do not output any warnings",
		extendedDescription: `Do not output any warnings. This includes all warnings during runtime, excluding parsing of command line arguments ${dv(green(getGlobalOption("warnings")))}`,
		handler() {
			setGlobalOption("warnings", false, 2)
		},
	})

	addFlag.empty({
		short: "E",
		long: "no-errors",
		value: "none",
		parameter: "",
		description: "Do not output any errors",
		extendedDescription: `Do not output any errors. This includes all runtime errors, excluding incorrect project startup ${dv(green(getGlobalOption("errors")))}`,
		handler() {
			setGlobalOption("errors", false, 2)
		},
	})

	addFlag.optional({
		short: "t",
		long: "timestamps",
		value: "optional",
		parameter: "[format]",
		description: `Include timestamps in all logging stuff, and optionaly pass the format. See ${green("TIMESTAMP FORMAT")}`,
		extendedDescription: `Include timestamps in all logging stuff ${dv(green(getGlobalOption("timestamps")))}, and optionaly pass the format how to format timestamp. See ${green("TIMESTAMP FORMAT")} ${dv(green(`'${getGlobalOption("timestampFormat")}'`))}`,
		handler(value) {
			setGlobalOption("timestamps", true, 2)
			if (value) {
				setGlobalOption("timestampFormat", value, 2)
			}
		},
	})

	addFlag.empty({
		short: "g",
		long: "gen-config",
		value: "none",
		parameter: "",
		description: `Generate default config file`,
		extendedDescription: `Generate default config file in the root of the project with default values`,
		handler() {
			genConfig()
			addText(`Generated '${green("config.toml")}' configuration file`)
			exit ||= true
		},
	})

	addFlag.empty({
		short: "O",
		long: "omit-config",
		value: "none",
		parameter: "",
		description: "Omit the configuration file",
		extendedDescription:
			"Omit the configuration file (don't load any value from it to the global options for runtime)",
		handler() {
			setGlobalConfigOption("useConfig", false)
		},
	})

	addFlag.required({
		short: "P",
		long: "port",
		value: "required",
		parameter: "<number>",
		description: "Port on which the server will be running",
		extendedDescription: `Port on which the server will be running ${dv(green(getServerOption("port")))}`,
		handler(value) {
			if (isStringNumber(value)) {
				setServerOption("port", +value, 2)
			} else {
				errorLog(`Flag -p accepted non-numeric value`)
			}
		},
	})

	addFlag.required({
		short: "H",
		long: "host",
		value: "required",
		parameter: "<host>",
		description: "Host on which the server will be running",
		extendedDescription: `Host on which the server will be running ${dv(green(`'${getServerOption("host")}'`))}`,
		handler(value) {
			errorLog(`Flag -H, --host is not implemented. Value is: '${value}'`)
		},
	})

	// test flag
	addFlag.empty({
		short: "X",
		long: "XXX",
		value: "none",
		parameter: "",
		description: "test, nothing spesial",
		extendedDescription: "",
		handler() {
			console.log(
				green(`[${formatDate(new Date(), getGlobalOption("timestampFormat"))}]`) +
					"handler called",
			)
		},
	})
}

function addText(text: any) {
	printMsg += `${!!printMsg ? "\n" : ""}${text}`
}

function addError(text: any) {
	errorMsg += `${!!errorMsg ? "\n" : ""}${text}`
}

function errorLog(text: any) {
	addError(error(text))
	isError ||= true
}

function checkFlagParamsOrder(params: FlagValueArray) {
	var current = params[0]
	if (current === undefined) return false
	for (var i = 1; i < params.length; i++) {
		if (current === "optional") {
			if (params[i] === "required") return false
		} else if (params[i] === "optional") current = "optional"
	}
	return true
}

/** Process command line arguments
 *
 * don't look at implementation...
 */
export function processFlags(argList: string[]) {
	setState("configuring")
	setupFlagHandlers()

	var flagHandler: Flag<FlagValueUnion>,
		nextArgument: string,
		flagArguments: string[] = [],
		argument: string,
		flag: string,
		multipleParamOk = true,
		i = 0,
		j = 0

	// 💀, but it's kinda fast, to be fair, and runtime-safe :)
	for (i = 0; i < argList.length; i++) {
		argument = argList[i]
		if (/^-[a-zA-Z]{2,}$/.test(argument)) {
			// short flag list
			for (flag of argument.slice(1)) {
				flag = `-${flag}`
				if (flags.has(flag)) {
					flagHandler = flags.get(flag)!
					if (flagHandler.value !== "none") {
						if (typeof flagHandler.value === "string") {
							if (flagHandler.value === "required")
								flagErrors.noProp(flag, flagHandler.parameter)
							else flagHandler.handler()
						} else if (Array.isArray(flagHandler.value)) {
							if (!checkFlagParamsOrder(flagHandler.value))
								flagErrors.incorrectParametersOrder(flag, flagHandler.value)
							else if (flagHandler.value.every((e) => e === "optional"))
								flagHandler.handler()
							else flagErrors.noProp(flag, flagHandler.parameter)
						} else flagErrors.wrongValueType(flag)
					} else flagHandler.handler()
				} else flagErrors.notRecognized(flag)
			}
		} else if (flagRegex.test(argument)) {
			// regular flag (short/long)
			flag = argument
			if (flags.has(flag)) {
				flagHandler = flags.get(flag)!
				if (Array.isArray(flagHandler.value)) {
					if (!checkFlagParamsOrder(flagHandler.value))
						flagErrors.incorrectParametersOrder(flag, flagHandler.value)
					else {
						multipleParamOk = true
						for (j = 0; j < flagHandler.value.length; j++) {
							nextArgument = argList[i + j + 1]
							if (nextArgument === undefined) {
								if (flagHandler.value[j] === "required") {
									flagErrors.noProp(flag, flagHandler.parameter)
									multipleParamOk = false
									break
								}
							} else if (flagRegex.test(nextArgument)) {
								if (flagHandler.value[j] === "required") {
									flagErrors.nextFlag(flag)
									multipleParamOk = false
									break
								}
							} else flagArguments.push(nextArgument)
						}
						if (multipleParamOk) flagHandler.handler(...flagArguments)
						i += flagArguments.length
						if (flagArguments.length) flagArguments = []
					}
				} else {
					if (flagHandler.value === "required") {
						nextArgument = argList[i + 1]
						if (nextArgument === undefined)
							flagErrors.noProp(flag, flagHandler.parameter)
						else {
							if (flagRegex.test(nextArgument)) flagErrors.nextFlag(flag)
							else flagHandler.handler(nextArgument), i++
						}
					} else if (flagHandler.value === "optional") {
						nextArgument = argList[i + 1]
						if (nextArgument === undefined) flagHandler.handler()
						else if (flagRegex.test(nextArgument)) flagHandler.handler()
						else flagHandler.handler(nextArgument), i++
					} else flagHandler.handler()
				}
			} else flagErrors.notRecognized(argument)
		} else flagErrors.notRecognized(argument)
	}

	if (isError) {
		console.log(errorMsg)
	}
	if (isFlagError) {
		console.log(readHelpPage)
	} else if (!isError && !isFlagError && exit) {
		console.log(printMsg)
	}
	if (isError || isFlagError || exit) process.exit()
	setState("ready")
	return printMsg
}
