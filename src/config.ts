import type {
	GlobalOptionProp,
	GlobalOptionPropPriority,
	GlobalOptions,
} from "./types"

export var globalOptions: GlobalOptions = {
	state: "original",
	version: "0.1.0",
	cacheTime: globalProp(15 * 60_000),
	cacheCheckTime: globalProp(60_000),
	output: globalProp(true),
	cache: globalProp(true),
	quiet: globalProp(false),
	avatars: globalProp(true),
	warnings: globalProp(true),
	errors: globalProp(true),
	logFeatures: globalProp(false),
	logOptions: {
		rest: globalProp(false),
		gif: globalProp(false),
		params: globalProp(false),
		cache: globalProp(false),
		"notify-on-restart": globalProp(false),
	},
}

var globalOptionsDefault = {
	cacheTime: 15 * 60_000, // in `ms`
	cacheCheckTime: 60_000, // in `ms`
	output: true, // there are some output by default
	cache: true,
	quiet: false,
	avatars: true,
	useConfig: true,
	warnings: true,
	errors: true,
	logFeatures: false,
	logOptions: {
		rest: false,
		gif: false,
		params: false,
		cache: false,
		"notify-on-restart": false,
	},
} as const

function globalProp<T>(v: T): GlobalOptionProp<T>
function globalProp<T, S extends GlobalOptionPropPriority>(
	v: T,
	s?: S,
): GlobalOptionProp<T>
function globalProp<T, S extends GlobalOptionPropPriority>(
	v: T,
	s?: S,
): GlobalOptionProp<T> {
	return { value: v, source: s ?? "config" }
}

setGlobalOption("cache", true, 2)

type FilterType<T, F = never> = {
	[K in keyof T as T[K] extends F ? never : K]: T[K]
}

type GlobalOptionsValuesAll = {
	[K in keyof GlobalOptions]: GlobalOptions[K] extends GlobalOptionProp<any>
		? GlobalOptions[K]["value"]
		: never
}

type GlobalOptionsValues = FilterType<GlobalOptionsValuesAll>

export function setGlobalOption<
	K extends keyof GlobalOptionsValues,
	V extends GlobalOptionsValues[K],
	P extends 0 | 1 | 2 | GlobalOptionPropPriority,
>(option: K, value: V, priority: P) {
	if (priority === 2 && priority === "arguments")
		if (typeof globalOptions[option] === typeof value)
			globalOptions[option] = globalProp(
				value,
			) as unknown as GlobalOptions[K]
}

export function resetGlobalOptions(): void
export function resetGlobalOptions(
	root: Record<string, any>,
	objToSet: Record<string, any>,
): void
export function resetGlobalOptions(
	root?: Record<string, any>,
	objToSet?: Record<string, any>,
) {
	root ??= globalOptionsDefault
	objToSet ??= globalOptions
	for (var [key, value] of Object.entries(root))
		if (Object.hasOwn(objToSet, key) && Object.hasOwn(root, key))
			if (typeof value === "object")
				resetGlobalOptions(value, objToSet[key])
			else objToSet[key] = globalProp(root[key])
}
