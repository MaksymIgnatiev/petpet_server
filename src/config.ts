class Config implements GlobalOptions {
	#state: GlobalOptions["state"] = "ready"
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
		return /[ \t]*at setState.+config.ts/.test(stack)
	}
	private checkGetStateCallStack(stack: string) {
		return /[ \t]*at (getState|setGlobalOption).+config.ts/.test(stack)
	}
	get state() {
		if (this.checkGetStateCallStack(new Error().stack ?? "")) {
			return this.#state
		} else {
			// Do not try to get the value of the 'state' field from other place, because it can be unsafe
			throw new Error(
				"Global option 'state' was retrieved from another place. It is preferable to use the 'getState' function",
			)
		}
	}
	set state(value) {
		if (this.checkSetStateCallStack(new Error().stack ?? "")) {
			this.#state = value
		} else {
			// Do not try to set the value of the 'state' field from other place, because it can be unsafe
			throw new Error(
				"Global option 'state' was set from another place. It is preferable to use the 'setState' function",
			)
		}
	}
}

export var globalOptionsDefault: AllGlobalConfigOptions = {
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
		timestampFormat: "h:m:s D.M.Y",
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
	// Absolute path to the root of the project
	ROOT_PATH = join(dirname(fileURLToPath(import.meta.url)), "../")

var globalOptions: GlobalOptions = new Config()

fileNotForRunning()

import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { hasNullable, sameType, fileNotForRunning, green } from "./functions"
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
	UnionToTuple,
	Values,
} from "./types"

var stateList = ["configuring", "ready"] satisfies UnionToTuple<
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
		"timestampFormat",
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
		"timestamps",
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
			`State for global configuration does not satisfies the type: ${stateList.map((e) => `'${green(e)}'`).join(" | ")}. State '${state}' was provided`,
		)
	}
}

export function setGlobalOption<
	K extends keyof GlobalOptionsValues,
	V extends GlobalOptionsValues[K],
	P extends GlobalOptionPropPriorityAll,
>(option: K, value: V, priority: P) {
	var success = false
	if (
		globalOptions.state === "configuring" &&
		!hasNullable(option, value, priority) &&
		comparePriorities(globalOptions[option].source, priority) < 0 &&
		sameType(globalOptions[option].value, value)
	) {
		globalOptions[option].value = value
		globalOptions[option].source = normalizePriority(priority, "string")
		success = true
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

type FilteredObjectProperties = FilterObjectProps<
	GlobalOptions,
	Record<string, GlobalOptionProp>
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

/** Compares 2 priorities.  `First < Second = -1`, `First === Second = 0`,  `First > Second = 1`
 * @returns Comparison result `-1 | 0 | 1`
 * */
export function comparePriorities<
	P1 extends GlobalOptionPropPriorityAll,
	P2 extends GlobalOptionPropPriorityAll,
>(first: P1, second: P2): ComparePriorities<P1, P2> {
	var p1: GlobalOptionPropPriorityLevel = normalizePriority(first),
		p2: GlobalOptionPropPriorityLevel = normalizePriority(second)
	return (
		p1 === p2 ? 0 : p1 < p2 ? -1 : p1 > p2 ? 1 : 0
	) as ComparePriorities<P1, P2>
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
	/** Sets the global object property, and returns a boolean value representing status of the process (true=`success`, false=`failure`) */
	return function <
		K extends keyof FilteredObjectProperties[O],
		V extends FilteredObjectProperties[O][K] extends GlobalOptionProp
			? FilteredObjectProperties[O][K]["value"]
			: never,
		P extends GlobalOptionPropPriorityAll,
	>(option: K, value: V, priority: P) {
		var success = true
		if (
			!hasNullable(option, value, priority) &&
			Object.hasOwn(globalOptions[object], option) &&
			sameType(globalOptions[object][option], value)
		) {
			var optionObj = globalOptions[object][option] as GlobalOptionProp<V>

			optionObj.value = value
			optionObj.source = normalizePriority(priority, "string")
			success = true
		}
		return success
	}
}

function createGlobalOptionObjectGetter<
	O extends keyof FilteredObjectProperties,
>(object: O) {
	return function <P extends keyof FilteredObjectProperties[O]>(
		option: P,
	): GlobalOptions[O][P] extends GlobalOptionProp
		? GlobalOptions[O][P]["value"]
		: never {
		return (globalOptions[object][option] as GlobalOptionProp).value
	}
}

export function setGlobalObjectOption<
	OBJ extends keyof FilteredObjectProperties,
	K extends keyof FilteredObjectProperties[OBJ],
	V extends FilteredObjectProperties[OBJ][K] extends GlobalOptionProp
		? FilteredObjectProperties[OBJ][K]["value"]
		: never,
	P extends GlobalOptionPropPriorityAll,
>(object: OBJ, key: K, value: V, priority: P) {
	var success = false
	if (
		!hasNullable(object, key, value, priority) &&
		Object.hasOwn(globalOptions, object) &&
		typeof globalOptions[object] === "object" &&
		Object.hasOwn(globalOptions[object], key) &&
		sameType(
			(globalOptions[object][key] as GlobalOptionProp<V>).value,
			value,
		) &&
		comparePriorities(
			(globalOptions[object][key] as GlobalOptionProp<V>).source,
			priority,
		) < 0
	) {
		var obj = globalOptions[object][key] as GlobalOptionProp<V>
		obj.value = value
		obj.source = normalizePriority(priority, "string")
		success = true
	}
	return success
}

export var setServerOption = createGlobalOptionObjectSetter("server"),
	getServerOption = createGlobalOptionObjectGetter("server"),
	setLogOption = createGlobalOptionObjectSetter("logOptions"),
	getLogOption = createGlobalOptionObjectGetter("logOptions")
