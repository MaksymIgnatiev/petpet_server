if (process.argv[1].match(/flags(.ts)?$/))
	console.log(
		error(
			`File ${green("@/src/flags.ts")} is a library file and is not intended to be run directly`,
		),
	),
		process.exit()

import { error, errorAndExit, green, isStringNumber } from "./functions"
import { getVersion, setGlobalOption, setState } from "./config"
import printHelp, { helpFlags } from "./help"
import type {
	Flag,
	FlagFull,
	FlagMaps,
	FlagShort,
	FlagShortFull,
	FlagShortRequire,
	FlagTupleFull,
	RequiredFlag,
	UnionToTuple,
} from "./types"

type FlagHandlerParam<F extends keyof FlagShortRequire> =
	FlagShortRequire[F] extends never
		? []
		: IsOptionalflag<F> extends true
			? [value?: string]
			: [value: string]

type FlagHandler<F extends keyof FlagShortRequire = keyof FlagShortRequire> = {
	required: IsRequiredflag<F>
	optional: IsOptionalflag<F>
	handler: (...args: FlagHandlerParam<F>) => void
}

var flagHandlers: Map<FlagFull, FlagHandler> = new Map(),
	flagRegex = /^-([a-z]|-[a-z\-]+)$/,
	readHelpPage =
		`Run '${green("bun run help")}' or '${green("bun start -h")}' to read the help page to see the correct flag usage` as const,
	flagHandlerDefaultOpts = {
		required: false,
		optional: false,
	},
	isFlagError = false,
	exit = false,
	flagErrors = {
		noProp(flag: string) {
			flagError(
				`Expected argument for flag '${green(flag)}', but argument was not provided`,
			)
			isFlagError ||= true
		},
		nextFlag(flag: string) {
			flagError(
				`Expected argument for flag '${green(flag)}', but next flag was passed`,
			)

			isFlagError ||= true
		},
		notRecognized(flag: string) {
			flagError(`Flag '${green(flag)}' is not recognized as valid`)
			isFlagError ||= true
		},
	}

function createFlagHandler<F extends keyof FlagShortRequire>(
	handler: (...args: FlagHandlerParam<F>) => void,
	options = flagHandlerDefaultOpts as FlagHandlerOptsType<F>,
): FlagHandler<F> {
	return {
		required: (options.required ?? false) as IsRequiredflag<F>,
		optional: (options.optional ?? false) as IsOptionalflag<F>,
		handler,
	}
}

function addFlagHandler<F extends keyof FlagShortRequire>(
	flags: FlagTupleFull,
	flagHandler: FlagHandler<F>,
) {
	for (var flag of flags)
		flagHandlers.set(
			flag,
			flagHandler as unknown as FlagHandler<keyof FlagShortRequire>,
		)
}

type FlagHandlerOptsType<F extends keyof FlagShortRequire> = Partial<{
	required: IsRequiredflag<F>
	optional: IsOptionalflag<F>
}>

type IsRequiredflag<F extends keyof FlagShortRequire> =
	RequiredFlag<F> extends "required" ? true : false
type IsOptionalflag<F extends keyof FlagShortRequire> =
	RequiredFlag<F> extends "optional" ? true : false

function newFlagHandler<
	SF extends keyof FlagShortRequire,
	LF extends FlagMaps[SF] = FlagMaps[SF],
>(
	flags: [`-${SF}`, `--${LF}`],
	handler: (...args: FlagHandlerParam<SF>) => void,
	options = flagHandlerDefaultOpts as FlagHandlerOptsType<SF>,
) {
	addFlagHandler(flags, createFlagHandler(handler, options))
}

function setupFlagHandlers() {
	newFlagHandler(
		["-h", "--help"],
		(value) => (
			printHelp(value as (typeof helpFlags)[number]), (exit = true)
		),
		{ optional: true },
	)
	newFlagHandler(
		["-v", "--version"],
		() => (console.log(getVersion()), (exit = true)),
	)
	newFlagHandler(["-q", "--quiet"], () => setGlobalOption("quiet", true, 1))
	newFlagHandler(["-C", "--no-cache"], () =>
		setGlobalOption("cache", false, 1),
	)
	newFlagHandler(["-A", "--no-avatars"], () =>
		setGlobalOption("avatars", false, 1),
	)
	newFlagHandler(["-L", "--log-features"], () =>
		setGlobalOption("logFeatures", true, 1),
	)
	newFlagHandler(
		["-g", "--gen-config"],
		(value) => {
			if (value) {
				if (value === "toml") {
					// genConfig("toml")
					console.log(
						`Generated configuration file for type: '${green("toml")}'`,
					)
				} else if (value === "env") {
					// genConfig("env")
					console.log(
						`Generated configuration file for type: '${green("env")}'`,
					)
				} else
					console.log(
						error(
							`Unknown configuration type for flag 'gen-config': '${green(value)}'`,
						),
					)
			} else {
				// genConfig("toml")
				console.log(
					`Generated configuration file for type: '${green("toml")}' (default)`,
				)
			}
			exit = true
		},
		{ optional: true },
	)

	newFlagHandler(
		["-c", "--cache-time"],
		(value: string) => {
			if (value && isStringNumber(value)) {
				setGlobalOption("cacheTime", +value, 1)
			} else flagError(`Flag 'c' acceepted not a number parameter`)
		},
		{ required: true },
	)
	newFlagHandler(
		["-t", "--timestamps"],
		(value?: string) => {
			setGlobalOption("timestamps", true, 1)
			if (value) setGlobalOption("timestampFormat", value, 1)
		},
		{ optional: true },
	)
}

function flagError(text: string) {
	console.log(error(text))
}
export function processFlags(argList: string[]) {
	setState("configuring")
	if (flagHandlers.size === 0) setupFlagHandlers()
	var flagHandler: FlagHandler, nextArgument: string
	for (var i = 0; i < argList.length; i++) {
		var argument = argList[i] as Flag
		if (/^-[a-z]{2,}$/.test(argument)) {
			// short flag list
			for (var flagShort of [
				...argument.slice(1),
			] as UnionToTuple<FlagShortFull>) {
				flagShort = `-${flagShort}` as FlagShortFull
				if (flagHandlers.has(flagShort)) {
					flagHandler = flagHandlers.get(flagShort)!
					if (!flagHandler.required) flagHandler.handler()
					else flagErrors.noProp(flagShort)
				} else flagErrors.notRecognized(flagShort)
			}
		} else if (flagRegex.test(argument)) {
			// flag detected
			var flag = argument as FlagFull
			if (flagHandlers.has(flag)) {
				flagHandler = flagHandlers.get(flag)!
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
