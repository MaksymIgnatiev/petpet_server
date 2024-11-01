class Config implements GlobalOptions {
	#state: GlobalOptions["state"] = "original"
	version = "0.1.0"
	avatars!: GlobalOptions["avatars"]
	cache!: GlobalOptions["cache"]
	cacheCheckTime!: GlobalOptions["cacheCheckTime"]
	cacheTime!: GlobalOptions["cacheTime"]
	configFile!: GlobalOptions["configFile"]
	cacheType!: GlobalOptions["cacheType"]
	errors!: GlobalOptions["errors"]
	logFeatures!: GlobalOptions["logFeatures"]
	logOptions!: GlobalOptions["logOptions"]
	permanentCache!: GlobalOptions["permanentCache"]
	quiet!: GlobalOptions["quiet"]
	server!: GlobalOptions["server"]
	warnings!: GlobalOptions["warnings"]
	watch!: GlobalOptions["watch"]
	timestamps!: GlobalOptions["timestamps"]
	timestampFormat!: GlobalOptions["timestampFormat"]
	useConfig!: GlobalOptions["useConfig"]
	constructor() {
		for (var rawKey in globalOptionsDefault) {
			var key = rawKey as keyof AllGlobalConfigOptions,
				value = globalOptionsDefault[key]

			Object.defineProperty(this, key, {
				value:
					typeof value === "object"
						? applyGlobalProp(value)
						: globalProp(value),
			})
		}
	}
	private checkSetStateCallStack(stack: string) {
		return !!stack
			.split(/\n+/)
			.some((l) => l.match(/[ \t]*at setState.+config.ts/))
	}
	private checkGetStateCallStack(stack: string) {
		return !!stack
			.split(/\n+/)
			.some((l) =>
				l.match(/[ \t]*at (getState|setGlobalOption).+config.ts/),
			)
	}
	get state() {
		if (this.checkGetStateCallStack(new Error().stack ?? ""))
			return this.#state
		else
			throw new Error(
				"Global option 'state' was retrieved from another place. It is preferable to use the 'getState' function",
			)
	}
	set state(value) {
		if (this.checkSetStateCallStack(new Error().stack ?? ""))
			this.#state = value
		else
			throw new Error(
				"Global option 'state' was set from another place. It is preferable to use the 'setState' function",
			)
	}
}

var globalOptionsDefault: AllGlobalConfigOptions = {
		cacheTime: 15 * 60_000, // 15 minutes, in `ms`
		cacheCheckTime: 60_000, // 1 minute, in `ms`
		cache: true,
		cacheType: "code",
		configFile: "default",
		avatars: true,
		useConfig: true,
		warnings: true,
		errors: true,
		logFeatures: false,
		quiet: false,
		permanentCache: false,
		watch: false,
		timestamps: false,
		timestampFormat: "s:m:h D.M.Y",
		logOptions: {
			rest: false,
			gif: false,
			params: false,
			cache: false,
			watch: false,
		},
		server: {
			port: 3000,
			host: "localhost",
		},
	},
	globalOptions: GlobalOptions = new Config()

if (process.argv[1].match(/config(.ts)?$/))
	console.log(
		error(
			`File ${green("@/src/config.ts")} is a library file and is not intended to be run directly`,
		),
	),
		process.exit()

import {
	hasNullable,
	checkPermisionForGlobalOption,
	error,
	green,
} from "./functions"
import type {
	AllGlobalConfigOptions,
	FilteredBooleanConfigProps,
	FilteredNumberConfigProps,
	FilteredObjectConfigProps,
	FilteredStringConfigProps,
	FilterObjectProps,
	GlobalOptionProp,
	GlobalOptionPropPriorityAll,
	GlobalOptionPropPriorityLevel,
	GlobalOptionPropPriorityString,
	GlobalOptions,
	GlobalOptionsValues,
	IndexOf,
	LogOptions,
	ServerOptions,
	UnionToTuple,
	Values,
} from "./types"

var stateList = ["original", "configuring", "ready"] satisfies UnionToTuple<
	GlobalOptions["state"]
>

export var priorityLevel: UnionToTuple<GlobalOptionPropPriorityString> = [
		"original",
		"config",
		"arguments",
	] as const,
	logLevel = ["rest", "gif", "params", "cache", "watch"] as const,
	numberOptions: (keyof FilteredNumberConfigProps)[] = [
		"cacheTime",
		"cacheCheckTime",
	],
	stringOptions: (keyof FilteredStringConfigProps)[] = [
		"configFile",
		"cacheType",
	],
	booleanOptions: (keyof FilteredBooleanConfigProps)[] = [
		"avatars",
		"cache",
		"errors",
		"logFeatures",
		"permanentCache",
		"quiet",
		"warnings",
		"watch",
	],
	objectOptions: (keyof FilteredObjectConfigProps)[] = [
		"server",
		"logOptions",
	]

function applyGlobalProp<O extends Values<FilteredObjectConfigProps>>(obj: O) {
	return Object.fromEntries(
		Object.entries(obj).map(([key, value]) => [key, globalProp(value)]),
	) as { [K in keyof O]: GlobalOptionProp<O[K]> }
}

function globalProp<T>(value: T): GlobalOptionProp<T>
function globalProp<T, S extends GlobalOptionPropPriorityString>(
	value: T,
	source?: S,
): GlobalOptionProp<T>
function globalProp<T, S extends GlobalOptionPropPriorityString>(
	value: T,
	source = "original" as S,
): GlobalOptionProp<T> {
	return { value, source }
}

export function getState() {
	return globalOptions.state
}
export function setState<S extends GlobalOptions["state"]>(state: S) {
	if (stateList.includes(state)) {
		globalOptions.state = state
	} else {
		// this will only work with type assertion. Don't play with it :)
		throw new Error(
			`State for global configuration does not satisfies the type: ${stateList.map((e) => `'${e}'`).join(" | ")}. State '${state}' was provided`,
		)
	}
}

export function setGlobalOption<
	K extends keyof GlobalOptionsValues,
	V extends GlobalOptionsValues[K],
	P extends GlobalOptionPropPriorityAll,
>(option: K, value: V, priority: P) {
	var success = true
	if (globalOptions.state !== "configuring") success = false
	else if (hasNullable(option, value, priority)) success = false
	else if (!checkPermisionForGlobalOption(option, priority)) success = false
	else if (typeof globalOptions[option].value !== typeof value)
		success = false
	else {
		globalOptions[option].value = value
		globalOptions[option].source = normalizePriority(priority, "string")
	}
	return success
}
type GetGlobalOptionValue<O extends keyof GlobalOptionsValues> =
	GlobalOptions[O]["value"]

export function getVersion() {
	return globalOptions.version
}

export function getGlobalOption<O extends keyof GlobalOptionsValues>(
	option: O,
): GetGlobalOptionValue<O> {
	return globalOptions[option].value
}

export function resetGlobalOptionsHandler() {
	setState("configuring")
	resetGlobalOptions()
	setState("ready")
}

function resetGlobalOptions(): void
function resetGlobalOptions(
	root: Record<string, any>,
	objToSet: Record<string, any>,
): void
function resetGlobalOptions(
	root?: Record<string, any>,
	objToSet?: Record<string, any>,
) {
	root ??= globalOptionsDefault
	objToSet ??= globalOptions
	for (var [key, value] of Object.entries(root))
		if (Object.hasOwn(objToSet, key) && Object.hasOwn(root, key))
			if (typeof value === "object")
				resetGlobalOptions(value, objToSet[key])
			else (objToSet.value = root[key]), (objToSet.source = "original")
}

export function logGlobalOptions() {
	console.log(globalOptions)
}

type FilteredObjectProperties = FilterObjectProps<
	GlobalOptions,
	Record<string, GlobalOptionProp<any>>
>
type CompareTable = {
	0: { 0: 0; 1: -1; 2: -1 }
	1: { 0: 1; 1: 0; 2: -1 }
	2: { 0: 1; 1: 1; 2: 0 }
}

type ComparePriorities<
	P1 extends GlobalOptionPropPriorityAll,
	P2 extends GlobalOptionPropPriorityAll,
> = CompareTable[GetPriotiry<P1, "number">][GetPriotiry<P2, "number">]

/** Compares 2 priorities. `First > Second = 1`, `First < Second = -1`, `First === Second = 0`
 * @returns Comparison result `-1 | 0 | 1`
 * */
export function comparePriorities<
	P1 extends GlobalOptionPropPriorityAll,
	P2 extends GlobalOptionPropPriorityAll,
>(priority1: P1, priority2: P2): ComparePriorities<P1, P2> {
	var p1: GlobalOptionPropPriorityLevel = normalizePriority(priority1),
		p2: GlobalOptionPropPriorityLevel = normalizePriority(priority2)
	return (
		p1 === p2 ? 0 : p1 < p2 ? -1 : p1 > p2 ? 1 : 0
	) as ComparePriorities<P1, P2>
}

export function setGlobalObjectOption<
	O extends keyof FilteredObjectProperties,
	P extends keyof FilteredObjectProperties[O],
	V extends FilteredObjectProperties[O][P] extends GlobalOptionProp<any>
		? FilteredObjectProperties[O][P]["value"]
		: never,
	S extends GlobalOptionPropPriorityAll,
>(obj: O, option: P, value: V, priority: S) {
	if (hasNullable(obj, option, value, priority)) return
	if (
		comparePriorities(
			(globalOptions[obj][option] as GlobalOptionProp<V>).source,
			priority,
		) < 1
	)
		return
	if (!Object.hasOwn(globalOptions, obj)) return
	if (!Object.hasOwn(globalOptions[obj], option)) return
	if (typeof globalOptions[obj][option] !== typeof value) return
	var optionObj = globalOptions[obj][option] as GlobalOptionProp<V>

	optionObj.value = value
	optionObj.source = normalizePriority(priority, "string")
}

type GetPriotiry<
	P extends GlobalOptionPropPriorityAll,
	T extends "string" | "number" = "number",
> = T extends "string"
	? P extends string
		? P
		: P extends number
			? (typeof priorityLevel)[P]
			: never
	: T extends "number"
		? P extends string
			? IndexOf<typeof priorityLevel, P>
			: P extends number
				? P
				: never
		: never

/**
 * @param type what value to return: `"number"`
 * @param priority what priority is coming in to test and get the value represented: `0`|`1`|`2`|`"original"`|`"config"`|`"arguments"`
 * @returns represented value of the given priority in provided `type`
 * "number" = `0`|`1`|`2`
 */
export function normalizePriority<P extends GlobalOptionPropPriorityAll>(
	priority: P,
): GetPriotiry<P, "number">
/**
 * @param priority what priority is coming in to test and get the value represented: `0`|`1`|`2`|`"original"`|`"config"`|`"arguments"`
 * @param type what value to return: `"string"`|`"number"`
 * @returns represented value of the given priority in provided `type`
 * "string" = `"original"`|`"config"`|`"arguments"`
 * "number" = `0`|`1`|`2`
 */
export function normalizePriority<
	P extends GlobalOptionPropPriorityAll,
	Type extends "string" | "number",
>(priority: P, type: Type): GetPriotiry<P, Type>
/**
 * @param priority what priority is coming in to test and get the value represented: `0`|`1`|`2`|`"original"`|`"config"`|`"arguments"`
 * @param type what value to return: `"string"`
 * @returns string represented value of the given priority (`"original"`|`"config"`|`"arguments"`)
 */
export function normalizePriority<
	P extends GlobalOptionPropPriorityString,
	Type extends "string",
>(priority: P, type: Type): GetPriotiry<P, Type>
/**
 * @param priority what priority is coming in to test and get the value represented: `0`|`1`|`2`|`"original"`|`"config"`|`"arguments"`
 * @param type what value to return: `"number"`
 * @returns number represented value of the given priority (`0`|`1`|`2`)
 */
export function normalizePriority<
	P extends GlobalOptionPropPriorityLevel,
	Type extends "number",
>(priority: P, type: Type): GetPriotiry<P, Type>

export function normalizePriority<
	P extends GlobalOptionPropPriorityAll,
	Type extends "string" | "number",
>(priority: P, type = "number" as Type): GetPriotiry<P, Type> {
	return (
		hasNullable(type, priority)
			? "config"
			: type === "string"
				? typeof priority === "string"
					? priority
					: priorityLevel[typeof priority === "number" ? priority : 0]
				: type === "number"
					? typeof priority === "string"
						? priorityLevel.indexOf(priority)
						: typeof priority === "number"
							? priority
							: 0
					: "original"
	) as GetPriotiry<P, Type>
}

export function getPriorityForOption<O extends keyof GlobalOptionsValues>(
	option: O,
): GlobalOptionPropPriorityString {
	return globalOptions[option]?.source ?? "original"
}

function createGlobalOptionObjectSetter<
	O extends keyof FilteredObjectProperties,
>(object: O) {
	return function <
		K extends keyof FilteredObjectProperties[O],
		V extends FilteredObjectProperties[O][K] extends GlobalOptionProp<any>
			? FilteredObjectProperties[O][K]["value"]
			: never,
		P extends GlobalOptionPropPriorityAll,
	>(option: K, value: V, priority: P) {
		var success = true
		if (hasNullable(option, value, priority)) success = false
		else if (!Object.hasOwn(globalOptions[object], option)) success = false
		else if (typeof globalOptions[object][option] !== typeof value)
			success = false
		else {
			var optionObj = globalOptions[object][option] as GlobalOptionProp<V>

			optionObj.value = value
			optionObj.source = normalizePriority(priority, "string")
		}
		return success
	}
}

export var setServerOption = createGlobalOptionObjectSetter("server")
export var setLogOption = createGlobalOptionObjectSetter("logOptions")

/* export function setLogOption<
	O extends keyof LogOptions,
	V extends LogOptions[O],
	P extends GlobalOptionPropPriorityAll,
>(option: O, value: V, priority: P) {
	if (hasNullable(option, value, priority)) return
} */

/** Checks if log option is turned on or of */
export function getLogOption<O extends keyof LogOptions>(option: O) {
	return (
		hasNullable(option)
			? false
			: (globalOptions.logOptions[option] ?? false)
	) as boolean
}

/** Returns server config option */
export function getServerOption<O extends keyof ServerOptions>(
	option: O,
): ServerOptions[O] {
	return (
		hasNullable(option)
			? undefined
			: (globalOptions.server[option]?.value ?? undefined)
	) as ServerOptions[O]
}
