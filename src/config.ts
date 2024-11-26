fileNotForRunning()

var callStackRegex =
	/^Error\n\s*at\s+check(S|G)etStateCallStack\s+.*config\.ts.*\n\s*at\s+state\s+.*config\.ts.*\n\s*at\s+((s|g)etState|setGlobalOption)\s+.*config\.ts/

class Config implements GlobalOptions {
	#state: GlobalOptions["state"] = "ready"
	readonly version = "0.1.0"
	accurateTime!: GlobalOptions["accurateTime"]
	alternateBuffer!: GlobalOptions["alternateBuffer"]
	avatars!: GlobalOptions["avatars"]
	cache!: GlobalOptions["cache"]
	cacheCheckTime!: GlobalOptions["cacheCheckTime"]
	cacheTime!: GlobalOptions["cacheTime"]
	cacheType!: GlobalOptions["cacheType"]
	compression!: GlobalOptions["compression"]
	config!: GlobalOptions["config"]
	clearOnRestart!: GlobalOptions["clearOnRestart"]
	errors!: GlobalOptions["errors"]
	logFeatures!: GlobalOptions["logFeatures"]
	logOptions!: GlobalOptions["logOptions"]
	permanentCache!: GlobalOptions["permanentCache"]
	quiet!: GlobalOptions["quiet"]
	server!: GlobalOptions["server"]
	timestamps!: GlobalOptions["timestamps"]
	timestampFormat!: GlobalOptions["timestampFormat"]
	useConfig!: GlobalOptions["useConfig"]
	verboseErrors!: GlobalOptions["verboseErrors"]
	warnings!: GlobalOptions["warnings"]
	watch!: GlobalOptions["watch"]
	constructor() {
		for (var rawKey in globalOptionsDefault) {
			var key = rawKey as keyof AllGlobalConfigOptions,
				value = globalOptionsDefault[key]
			Object.defineProperty(this, key, {
				value: typeof value === "object" ? applyGlobalProp(value) : globalProp(value),
			})
		}
	}
	private checkSetStateCallStack() {
		return callStackRegex.test(new Error().stack ?? "")
	}

	private checkGetStateCallStack() {
		return callStackRegex.test(new Error().stack ?? "")
	}
	get state() {
		if (this.checkGetStateCallStack()) {
			return this.#state
		} else {
			// Do not try to get the value of the 'state' field from other place, because it can be unsafe
			throw new Error(
				"Global option 'state' was retrieved from another place. It is preferable to use the 'getState' function from './src/config.ts' file",
			)
		}
	}
	set state(value) {
		if (this.checkSetStateCallStack()) {
			this.#state = value
		} else {
			// Do not try to set the value of the 'state' field from other place, because it can be unsafe
			throw new Error(
				"Global option 'state' was set from another place. It is preferable to use the 'setState' function from './src/config.ts' file",
			)
		}
	}
}

export var globalOptionsDefault: AllGlobalConfigOptions = {
		accurateTime: true, // false
		alternateBuffer: true,
		avatars: true,
		cacheTime: 15 * 60_000, // 15 minutes in `ms`
		cacheCheckTime: 60_000, // 1  minute  in `ms`
		cache: true,
		cacheType: "code",
		compression: true,
		clearOnRestart: true,
		config: false,
		errors: true,
		logFeatures: false,
		quiet: false,
		permanentCache: false,
		warnings: true,
		watch: true, // false
		timestamps: true, // false
		timestampFormat: "h:m:s:S.u", // "h:m:s D.M.Y"
		useConfig: true,
		verboseErrors: false,
		logOptions: {
			rest: true, // false
			gif: false,
			params: false,
			cache: false,
			watch: false,
		},
		server: {
			port: 3000,
			host: "0.0.0.0", // "localhost"
		},
	},
	/** Absolute path to the root of the project */
	ROOT_PATH = join(dirname(fileURLToPath(import.meta.url)), "../"),
	priorityLevel = ["original", "config", "arguments"] as const,
	logLevel = ["rest", "gif", "params", "cache", "watch"] as const

var globalOptions: GlobalOptions = new Config(),
	stateList = ["configuring", "ready"] as const,
	configOptions = ["useConfig", "config"] as const

import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { hasNullable, sameType, fileNotForRunning, green } from "./functions"
import type {
	AdditionalGlobalOptions,
	AllGlobalConfigOptions,
	FilteredObjectConfigProps,
	FilterObjectProps,
	GlobalOptionProp,
	GlobalOptionPropPriorityAll,
	GlobalOptionPropPriorityLevel,
	GlobalOptionPropPriorityString,
	GlobalOptions,
	GlobalOptionsValues,
	IndexOf,
	Values,
} from "./types"

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
			`State for global configuration does not satisfies the type: '${stateList.map(green).join("' | '")}'. State '${state}' was provided`,
		)
	}
}

/** Set the config specific values that can be modified everywhere any time, just to trac some ofher states */
export function setGlobalConfigOption<
	K extends keyof AdditionalGlobalOptions,
	V extends AdditionalGlobalOptions[K],
>(option: K, value: V) {
	var success = false
	if (
		!hasNullable(option, value) &&
		Object.hasOwn(globalOptions, option) &&
		sameType(globalOptions[option].value, value)
	) {
		globalOptions[option].value = value
		success = true
	}
	return success
}

/** Set the config specific values that can be modified everywhere any time, just to trac some ofher states */
export function getGlobalConfigOption<K extends keyof AdditionalGlobalOptions>(
	option: K,
): AdditionalGlobalOptions[K] {
	return globalOptions[option].value
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
		Object.hasOwn(globalOptions, option) &&
		comparePriorities(globalOptions[option].source, priority) < 0 &&
		sameType(globalOptions[option].value, value)
	) {
		globalOptions[option].value = value
		globalOptions[option].source = normalizePriority(priority, "string")
		success = true
	}
	return success
}
type GetGlobalOptionValue<O extends keyof GlobalOptionsValues> = GlobalOptions[O]["value"]

export function getVersion() {
	return globalOptions.version
}

export function getGlobalOption<O extends keyof GlobalOptionsValues>(
	option: O,
): GetGlobalOptionValue<O> {
	return globalOptions[option].value
}

export function resetGlobalOptionsHandler(prepareState = true) {
	prepareState && setState("configuring")
	resetGlobalOptions()
	prepareState && setState("ready")
}
export function logGlobalOptions() {
	console.dir(globalOptions, { depth: null, colors: true })
}
function resetGlobalOptions(): void
function resetGlobalOptions(root: Record<string, any>, objToSet: Record<string, any>): void
function resetGlobalOptions(root?: Record<string, any>, objToSet?: Record<string, any>) {
	root ??= globalOptionsDefault
	objToSet ??= globalOptions
	for (var [key, value] of Object.entries(root))
		if (typeof value === "object") resetGlobalOptions(value, objToSet[key])
		else {
			objToSet[key].value = value
			objToSet[key].source = "original"
		}
}

type FilteredObjectProperties = FilterObjectProps<GlobalOptions, Record<string, GlobalOptionProp>>
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
	return (p1 === p2 ? 0 : p1 < p2 ? -1 : p1 > p2 ? 1 : 0) as ComparePriorities<P1, P2>
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
export function normalizePriority<P extends GlobalOptionPropPriorityString, Type extends "string">(
	priority: P,
	type: Type,
): GetPriotiry<P, Type>
/**
 * @param priority what priority is coming in to test and get the value represented: `0`|`1`|`2`|`"original"`|`"config"`|`"arguments"`
 * @param type what value to return: `"number"`
 * @returns number represented value of the given priority (`0`|`1`|`2`)
 */
export function normalizePriority<P extends GlobalOptionPropPriorityLevel, Type extends "number">(
	priority: P,
	type: Type,
): GetPriotiry<P, Type>

export function normalizePriority<
	P extends GlobalOptionPropPriorityAll,
	Type extends "string" | "number",
>(priority: P, type = "number" as Type): GetPriotiry<P, Type> {
	return (
		hasNullable(type, priority)
			? "original"
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

/** Creates a setter for global properties on object properties */
function createGlobalOptionObjectSetter<O extends keyof FilteredObjectProperties>(object: O) {
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
			comparePriorities(
				(globalOptions[object]?.[option] as GlobalOptionProp).value,
				priority,
			) < 0 &&
			sameType(globalOptions[object]?.[option], value)
		) {
			var optionObj = globalOptions[object][option] as GlobalOptionProp<V>

			optionObj.value = value
			optionObj.source = normalizePriority(priority, "string")
			success = true
		}
		return success
	}
}

/** Creates a getter for global properties on object properties */
function createGlobalOptionObjectGetter<O extends keyof FilteredObjectProperties>(object: O) {
	return function <P extends keyof FilteredObjectProperties[O]>(
		option: P,
	): GlobalOptions[O][P] extends GlobalOptionProp ? GlobalOptions[O][P]["value"] : never {
		return (globalOptions[object][option] as GlobalOptionProp).value
	}
}

export function getGlobalObject<OBJ extends keyof FilteredObjectProperties>(
	object: OBJ,
): Readonly<FilteredObjectProperties[OBJ]> {
	return globalOptions[object]
}

/** Universal function for setting global options on object options */
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
		!Array.isArray(globalOptions[object]) &&
		Object.hasOwn(globalOptions[object], key) &&
		sameType((globalOptions[object][key] as GlobalOptionProp<V>).value, value) &&
		comparePriorities((globalOptions[object][key] as GlobalOptionProp<V>).source, priority) < 0
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
