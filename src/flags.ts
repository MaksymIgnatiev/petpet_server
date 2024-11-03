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
import type { Flag as FlagType, FlagValue, UnionToTuple } from "./types"

type Flag<T extends FlagValue> = Omit<FlagType<T>, "description" | "parameter">

var flagRegex = /^-([a-z]|-[a-z\-]+)$/,
	readHelpPage =
		`Run '${green("bun run help")}' or '${green("bun start -h")}' to read the help page to see the correct flag usage` as const,
	isFlagError = false,
	exit = false,
	flagErrors = {
		noProp(flag: string) {
			errorLog(
				`Expected argument for flag '${green(flag)}', but argument was not provided`,
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
	},
	flagMaps: Map<string, Flag<FlagValue>> = new Map(),
	addFlag = {
		verbose(flag: Flag<"none">) {
			addFlagHandler(flag)
		},
		optional(flag: Flag<"optional">) {
			addFlagHandler(flag)
		},
		required(flag: Flag<"required">) {
			addFlagHandler(flag)
		},
	}

function addFlagHandler<V extends FlagValue>(flag: Flag<V>) {
	if (flag.short) flagMaps.set(`-${flag.short}`, flag)
	flagMaps.set(`--${flag.long}`, flag)
}

function setupFlagHandlers() {
	addFlag.optional({
		short: "h",
		long: "help",
		value: "optional",
		handler(value) {
			printHelp(value as (typeof helpFlags)[number])
			exit = true
		},
	})

	addFlag.verbose({
		short: "v",
		long: "version",
		value: "none",
		handler() {
			console.log(getVersion())
			exit = true
		},
	})

	addFlag.verbose({
		short: "q",
		long: "quiet",
		value: "none",
		handler() {
			setGlobalOption("quiet", true, 1)
		},
	})

	addFlag.verbose({
		short: "C",
		long: "no-cache",
		value: "none",
		handler() {
			setGlobalOption("cache", false, 1)
		},
	})

	addFlag.verbose({
		short: "A",
		long: "no-avatars",
		value: "none",
		handler() {
			setGlobalOption("avatars", false, 1)
		},
	})

	addFlag.verbose({
		short: "L",
		long: "log-features",
		value: "none",
		handler() {
			setGlobalOption("logFeatures", true, 1)
		},
	})

	addFlag.optional({
		short: "g",
		long: "gen-config",
		value: "optional",
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
		short: "c",
		long: "cache-time",
		value: "required",
		handler(value) {
			if (value && isStringNumber(value)) {
				setGlobalOption("cacheTime", +value, 1)
			} else {
				errorLog(`Flag 'c' accepted a non-numeric parameter`)
			}
		},
	})

	addFlag.optional({
		short: "t",
		long: "timestamps",
		value: "optional",
		handler(value) {
			setGlobalOption("timestamps", true, 1)
			if (value) {
				setGlobalOption("timestampFormat", value, 1)
			}
		},
	})
}

function errorLog(text: string) {
	console.log(error(text))
}

export function processFlags(argList: string[]) {
	setState("configuring")
	if (flags.size === 0) setupFlagHandlers()
	var flagHandler: FlagHandler, nextArgument: string
	for (var i = 0; i < argList.length; i++) {
		var argument = argList[i] as Flag
		if (/^-[a-z]{2,}$/.test(argument)) {
			// short flag list
			for (var flagShort of [
				...argument.slice(1),
			] as UnionToTuple<FlagShortFull>) {
				flagShort = `-${flagShort}` as FlagShortFull
				if (flags.has(flagShort)) {
					flagHandler = flags.get(flagShort)!
					if (!flagHandler.required) flagHandler.handler()
					else flagErrors.noProp(flagShort)
				} else flagErrors.notRecognized(flagShort)
			}
		} else if (flagRegex.test(argument)) {
			// flag detected
			var flag = argument as FlagFull
			if (flags.has(flag)) {
				flagHandler = flags.get(flag)!
				if (flagHandler.required) {
					nextArgument = argList[i + 1]
					if (nextArgument) {
						if (!flagRegex.test(nextArgument))
							flagHandler.handler(nextArgument), i++
						else flagErrors.nextFlag(flag)
					} else flagErrors.noProp(flag)
				} else if (flagHandler.optional) {
					nextArgument = argList[i + 1]
					if (nextArgument === undefined) flagHandler.handler()
					else if (!flagRegex.test(nextArgument))
						flagHandler.handler(nextArgument), i++
					else flagHandler.handler()
				} else flagHandler.handler()
			} else flagErrors.notRecognized(argument)
		} else flagErrors.notRecognized(argument)
	}
	isFlagError && console.log(readHelpPage)
	;(isFlagError || exit) && process.exit()
	setState("ready")
}
