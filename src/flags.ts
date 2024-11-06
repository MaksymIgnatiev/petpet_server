if (process.argv[1].match(/flags(.ts)?$/))
	console.log(
		error(
			`File ${green("@/src/flags.ts")} is a library file and is not intended to be run directly`,
		),
	),
		process.exit()

import { error, green, isStringNumber } from "./functions"
import { getVersion, setGlobalOption, setState } from "./config"
import printHelp, { helpFlags } from "./help"
import type { Flag, FlagValueArray, FlagValueUnion } from "./types"

var flagRegex = /^-([a-zA-Z]|-[a-z\-]+)$/,
	readHelpPage =
		`Run '${green("bun run help")}' or '${green("bun start -h")}' to read the help page to see the correct flag usage` as const,
	isFlagError = false,
	exit = false,
	flagErrors = {
		noProp(flag: string, args?: string | string[]) {
			errorLog(
				`Expected argument for flag '${green(flag)}', but argument was not provided${formatParamsForerror(args)}`,
			)
			isFlagError ||= true
		},
		nextFlag(flag: string) {
			errorLog(
				`Expected argument for flag '${green(flag)}', but next flag was passed`,
			)

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
				`Type of 'value' property on flag '${green(flag)}' is not compatitable with expected type. Consider reading '${green("@/src/types")}' file under the '${green("Flag<T extends FlagValueUnion>")}' type`,
			)
		},
	}

function formatParamsForerror(args?: string | string[]) {
	var result = ""

	if (args !== undefined) {
		if (Array.isArray(args))
			result = `. Arguments: ${args.map(green).join(" ")}`
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
		description: `Display this help message or a spesific section (alias is also '${green("bun run help")}') (see ${green("SECTIONS")})`,
		extendedDescription: "extended",
		handler(value) {
			printHelp(value as (typeof helpFlags)[number])
			exit = true
		},
	})

	addFlag.empty({
		short: "v",
		long: "version",
		value: "none",
		parameter: "",
		description: "Display version and exit",
		extendedDescription: "",
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
		extendedDescription: "",
		handler() {
			setGlobalOption("quiet", true, 1)
		},
	})

	addFlag.required({
		short: "l",
		long: "log",
		value: "required",
		parameter: "<level|feature...>",
		description: `Log level (0-4) or custom features to log. See ${green("LOG OPTIONS")} section`,
		extendedDescription: "",
		handler(value) {
			errorLog(`Flag -l, --log is not implemented. Value is: '${value}'`)
		},
	})

	addFlag.empty({
		short: "L",
		long: "log-features",
		value: "none",
		parameter: "",
		description: "Display which log features are enabled on startup",
		extendedDescription: "",
		handler() {
			setGlobalOption("logFeatures", true, 1)
		},
	})

	addFlag.required({
		short: "c",
		long: "cache-time",
		value: "required",
		parameter: "<ms>",
		description: `Set cache time to a value in miliseconds (default=${green(900000)} ms, ${green(15)} mins)`,
		extendedDescription: "",
		handler(value) {
			if (isStringNumber(value)) setGlobalOption("cacheTime", +value, 1)
			else
				errorLog(
					`Flag '${green("c")}' accepted a non-numeric parameter`,
				)
		},
	})

	addFlag.required({
		long: "cache-type",
		value: "required",
		parameter: "<code|fs|both>",
		description: `What kind of cache to use (default=${green("code")})`,
		extendedDescription: "",
		handler(value) {
			errorLog(
				`Flag --cache-type is not implemented. Value is: '${value}'`,
			)
		},
	})

	addFlag.empty({
		short: "C",
		long: "no-cache",
		value: "none",
		parameter: "",
		description: "Do not store any cache",
		extendedDescription: "",
		handler() {
			setGlobalOption("cache", false, 1)
		},
	})

	addFlag.empty({
		short: "A",
		long: "no-avatars",
		value: "none",
		parameter: "",
		description: "Do not store avatars",
		extendedDescription: "",
		handler() {
			setGlobalOption("avatars", false, 1)
		},
	})

	addFlag.empty({
		short: "W",
		long: "no-warnings",
		value: "none",
		parameter: "",
		description:
			"Do not output any warnings. This includes all warnings during runtime, excluding parsing of command line arguments",
		extendedDescription: "",
		handler() {
			setGlobalOption("warnings", false, 1)
		},
	})

	addFlag.empty({
		short: "E",
		long: "no-errors",
		value: "none",
		parameter: "",
		description:
			"Do not output any errors. This includes all runtime errors, excluding incorrect project startup",
		extendedDescription: "",
		handler() {
			setGlobalOption("errors", false, 1)
		},
	})

	addFlag.optional({
		short: "t",
		long: "timestamps",
		value: "optional",
		parameter: "[format]",
		description: `Include timestamps in all logging stuff, and optionaly pass the format how to output timestamp. See ${green("TIMESTAMP FORMAT")} (default=${green('"h:m:s D.M.Y"')})`,
		extendedDescription: "",
		handler(value) {
			setGlobalOption("timestamps", true, 1)
			if (value) {
				setGlobalOption("timestampFormat", value, 1)
			}
		},
	})

	addFlag.optional({
		short: "g",
		long: "gen-config",
		value: "optional",
		parameter: "[toml|env]",
		description: `Generate default config file in the root of progect (for spesific file type, if spesified) (default=${green("toml")})`,
		extendedDescription: "",
		handler(value) {
			if (value) {
				if (value === "toml") {
					console.log(
						`Generated configuration file for type: '${green("toml")}'`,
					)
				} else if (value === "env") {
					console.log(
						`Generated configuration file for type: '${green("env")}'`,
					)
				} else {
					console.log(
						error(
							`Unknown configuration type for flag 'gen-config': '${green(value)}'`,
						),
					)
				}
			} else {
				console.log(
					`Generated configuration file for type: '${green("toml")}' (default)`,
				)
			}
			exit = true
		},
	})

	addFlag.required({
		short: "P",
		long: "port",
		value: "required",
		parameter: "<integer>",
		description: "The port on which the server will be running",
		extendedDescription: "",
		handler(value) {
			errorLog(`Flag -P, --port is not implemented. Value is: '${value}'`)
		},
	})

	addFlag.required({
		short: "H",
		long: "host",
		value: "required",
		parameter: "<host>",
		description: "The port on which the server will be running",
		extendedDescription: "",
		handler(value) {
			errorLog(`Flag -H, --host is not implemented. Value is: '${value}'`)
		},
	})

	// test flag
	addFlag.multipleParams({
		short: "Z",
		long: "test",
		value: ["required", "optional"] as const,
		parameter: ["<required>", "[h]"],
		description: "",
		extendedDescription: "",
		handler(...args) {
			console.log({ args })
		},
	})

	// test flag
	addFlag.multipleParams({
		short: "X",
		long: "kkk",
		value: ["required", "optional"] as const,
		parameter: ["<required>", "[h]"],
		description: "a",
		extendedDescription: "",
		handler(...args) {
			console.log(`args for flag 'X':`, { args })
		},
	})
}

function errorLog(text: string) {
	console.log(error(text))
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
								flagErrors.incorrectParametersOrder(
									flag,
									flagHandler.value,
								)
							else if (
								flagHandler.value.every((e) => e === "optional")
							)
								flagHandler.handler()
							else flagErrors.noProp(flag, flagHandler.parameter)
						} else flagErrors.wrongValueType(flag)
					} else flagHandler.handler()
				} else flagErrors.notRecognized(flag)
			}
		} else if (flagRegex.test(argument)) {
			// flag detected
			flag = argument
			if (flags.has(flag)) {
				flagHandler = flags.get(flag)!
				if (Array.isArray(flagHandler.value)) {
					if (!checkFlagParamsOrder(flagHandler.value))
						flagErrors.incorrectParametersOrder(
							flag,
							flagHandler.value,
						)
					else {
						multipleParamOk = true
						for (j = 0; j < flagHandler.value.length; j++) {
							nextArgument = argList[i + j + 1]
							if (nextArgument === undefined) {
								if (flagHandler.value[j] === "required") {
									flagErrors.noProp(
										flag,
										flagHandler.parameter,
									)
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
						if (multipleParamOk)
							flagHandler.handler(...flagArguments)
						i += flagArguments.length
						if (flagArguments.length) flagArguments = []
					}
				} else {
					if (flagHandler.value === "required") {
						nextArgument = argList[i + 1]
						if (nextArgument === undefined)
							flagErrors.noProp(flag, flagHandler.parameter)
						else {
							if (flagRegex.test(nextArgument))
								flagErrors.nextFlag(flag)
							else flagHandler.handler(nextArgument), i++
						}
					} else if (flagHandler.value === "optional") {
						nextArgument = argList[i + 1]
						if (nextArgument === undefined) flagHandler.handler()
						else if (flagRegex.test(nextArgument))
							flagHandler.handler()
						else flagHandler.handler(nextArgument), i++
					} else flagHandler.handler()
				}
			} else flagErrors.notRecognized(argument)
		} else flagErrors.notRecognized(argument)
	}
	if (isFlagError) console.log(readHelpPage)
	if (isFlagError || exit) process.exit()
	setState("ready")
}
