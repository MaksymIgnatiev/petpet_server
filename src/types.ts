fileNotForRunning()

import type { logLevel } from "./config"
import type { Avatar, PetPet } from "./db"
import { fileNotForRunning } from "./functions"

// ---- Utility types ----
export type PositiveNumber = number
export type Positive<T extends number> = `${T}` extends `${infer C}${infer _}`
	? C extends "-"
		? never
		: number
	: never
export type ArrayRange<L extends number, Acc extends any[] = []> = Acc["length"] extends L
	? Acc
	: ArrayRange<L, [...Acc, Acc["length"]]>
export type RangeType<S extends number = number, E extends number = number> = number | S | E
export type Range<
	Start extends number,
	End extends number,
	T extends any[] = ArrayRange<Start>,
> = T["length"] extends End ? T["length"] : T["length"] | Range<Start, End, [...T, 0]>

export type ANSIColor = ANSIRGB | ANSIColorShort
export type ANSIColorShort = `$;5;${number}`
export type ANSIRGB<
	R extends number = number,
	G extends number = number,
	B extends number = number,
	T extends "fg" | "bg" = "fg" | "bg",
> = `${T extends "fg" ? "38" : "48"};2;${R};${G};${B}`

/** Promise that always resolve a value without any failures */
export type AlwaysResolvingPromise<T> = Omit<Promise<T>, "catch" | "then"> & {
	then<TResult = T>(callback?: (value: T) => TResult | PromiseLike<TResult>): Promise<TResult>
}

/** Returns values of the object */
export type Values<T extends Record<any, any>> = T[keyof T]

/** Returns index of given element as a number literal, or `never` */
export type IndexOf<T extends readonly any[], U, Acc extends readonly any[] = []> = T extends [
	infer First,
	...infer Rest,
]
	? First extends U
		? Acc["length"]
		: IndexOf<Rest, U, [...Acc, any]>
	: never
/** Make all object's props optional, and do it recursively */
export type PartialAllObjectsProps<O extends Record<any, any>> = {
	[K in keyof O]?: O[K] extends Record<any, any> ? PartialAllObjectsProps<O[K]> : O[K]
}

/** Exclude `key: value` pairs, value's type of which is specified  */
export type ExcludeObjectProps<O extends Record<any, any>, T = any> = {
	[K in keyof O as O[K] extends T ? never : K]: O[K]
}

/** Filter object's props by provided type */
export type FilterObjectProps<O extends Record<any, any>, T = never> = {
	[K in keyof O as O[K] extends T ? K : never]: O[K]
}

/** Pick last type in a Union type */
export type Last<T> = (
	(T extends any ? (x: () => T) => void : never) extends (x: infer I) => void ? I : never
) extends () => infer U
	? U
	: never

/** Convert Union type to tuple of types */
export type UnionToTuple<T, A extends any[] = []> = [T] extends [never]
	? A
	: UnionToTuple<Exclude<T, Last<T>>, [Last<T>, ...A]>

/** Join strings with a separator */
export type Join<Tuple extends readonly string[], Separator extends string = ""> = Tuple extends [
	// need a fix at `readonly`
	infer First extends string,
	...infer Rest extends string[],
]
	? Rest["length"] extends 0
		? First
		: `${First}${Separator}${Join<Rest, Separator>}`
	: ""

export type TupleToUnion<T extends any[] | readonly any[]> = T[number]

/** Create a variations of strings out of Union type and an optional separator */
export type Combinations<
	T extends string,
	S extends string = "",
	_ extends string = T,
> = T extends any ? T | `${T}${S}${Combinations<Exclude<_, T>, S>}` : never

// ---- Options ----

export type GlobalOptionPropPriorityString = "original" | "config" | "arguments"
export type GlobalOptionPropPriorityLevel = 0 | 1 | 2
export type GlobalOptionPropPriorityAll =
	| GlobalOptionPropPriorityLevel
	| GlobalOptionPropPriorityString
export type GlobalOptionProp<T = any> = {
	value: T
	source: GlobalOptionPropPriorityString
}

export type GlobalOptionsValues = ExcludeObjectProps<BaseConfigOptions, Record<string, any>>
type ApplyGlobalOptionPropTypeRecursively<O extends Record<string, any>> = {
	[K in keyof O]: O[K] extends Record<string, any>
		? ApplyGlobalOptionPropTypeRecursively<O[K]>
		: GlobalOptionProp<O[K]>
}

export type BaseConfigOptions = {
	/** Enable microseconds notation in milliseconds values, and milliseconds notation in minutes (default=`false`) */
	accurateTime: boolean
	/** Use alternate buffer to run the main application or not (output may mess up shell state) (default=`true`) */
	alternateBuffer: boolean
	/** Cache avatars to reduce amount of requests to get them (default=`true`) */
	avatars: boolean
	/** Store cache or not (default=`true`) */
	cache: boolean
	/** How often to check cached GIFs after last request in milliseconds (default=`60_000` ms, `1` min) */
	cacheCheckTime: number
	/** How long to cache GIFs in milliseconds (default=`900_000` ms, `15` min) */
	cacheTime: number
	/** Cache type. `"code"` - store cache in code itself, `"fs"` - in filesystem, `"both"` - both types together (default=`"code"`)*/
	cacheType: "code" | "fs" | "both"
	/** Use compression to store all cache in code in compressed format or not (default=`true`) */
	compression: boolean
	/** Clear the stdout on server restart due to changes in config file (default=`true`) */
	clearOnRestart: boolean
	/** Log errors during runtime (default=`true`) */
	errors: boolean
	/** Show what log features are enabled (default=`false`) */
	logFeatures: boolean
	/** Options for logging (all default=`false`):
	 * `rest`   - log requests and responses
	 * `gif`    - log gif creation time & when gif was in cache
	 * `params` - log each gif requesr params
	 * `cache`  - log cache related things (perform, cleanup, info, etc.)
	 * `watch`  - log when server restarted due to changes in config file (`watch` option needs to be enabled)
	 */
	logOptions: LogOptions
	/** Store cache permanent (without checks) (default=`false`) */
	permanentCache: boolean
	/** Do some output, or run server without any output (during runtime, not during parsing flags/config files) (default=`true`) */
	quiet: boolean
	/** Server configuration (default values)
	 * `port` = `3000`
	 * `host` = `"localhost"`
	 */
	server: ServerOptions
	/** Include timestamps in all logging stuff (default=`false`) */
	timestamps: boolean
	/** Format for the timestamps represented with a string with formating characters (default=`"h:m:s D.M.Y"`)
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
	 * |   Y    | year |
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
	 */
	timestampFormat: string
	/** Show full errors on each error during runtime */
	verboseErrors: boolean
	/** Log warnings during runtime (default=`true`) */
	warnings: boolean
	/** Watch the configuration files, and rerun the server on change (default=`false`) */
	watch: boolean
}

export type AdditionalGlobalOptions = {
	/** Use the configuration files or not (default=`true`) */
	useConfig: boolean
	/** In alternate buffer or not */
	inAlternate: boolean
}

type AllGlobalConfigOptionsBase = BaseConfigOptions & AdditionalGlobalOptions
export type AllGlobalConfigOptions = Readonly<AllGlobalConfigOptionsBase>

/** Options for global behaviour and settings */
export type GlobalOptions = {
	/** Version of the project */
	readonly version: string
	/** State of the configuration
	 * `"configuring"` - in process of configuring all runtime options
	 * `"ready"` - when configuration is ready for usage (not in configuration phase)
	 */
	state: "configuring" | "ready"
} & ApplyGlobalOptionPropTypeRecursively<AllGlobalConfigOptions>

// ----- Log Options -----

type LogLevelToArrIndex = {
	0: never
	1: 0
	2: 1
	3: 2
	4: 3
	5: 4
}

export type GetLogOption<O extends LogOptionShort | LogOptionLong | LogLevel> = O extends LogLevel
	? LogLevelToArrIndex[O] extends never
		? undefined
		: (typeof logLevel)[LogLevelToArrIndex[O]]
	: O extends LogOptionShort
		? {
				[K in keyof LogOptions]: K extends `${O}${string}` ? K : never
			}[keyof LogOptions]
		: O extends LogOptionLong
			? O
			: never

export type LogOption = LogString | LogLevel
export type LogOptions<
	R extends boolean = boolean,
	G extends boolean = boolean,
	P extends boolean = boolean,
	C extends boolean = boolean,
	W extends boolean = boolean,
> = {
	/** Log requests and responses (default=`false`) */
	rest: R
	/** Log gif creation time & when gif was in cache (default=`false`) */
	gif: G
	/** Log request params (default=`false`) */
	params: P
	/** Log cache related info (default=`false`) */
	cache: C
	/** Inform when server restarts (`watch` option needs to be enabled) (default=`false`) */
	watch: W
}
export type LogString = LogOptionLongCombination | LogOptionShortCombination
export type LogStringOne = LogOptionLong | LogOptionShort
export type LogLevel = 0 | 1 | 2 | 3 | 4 | 5

export type LogOptionLongCombination = Combinations<LogOptionLong, ",">
export type LogOptionShortCombination = Combinations<LogOptionShort, ",">
export type LogOptionLong = keyof LogOptions
export type LogOptionShort = {
	[S in LogOptionLong]: S extends `${infer C}${infer _}` ? C : never
}[LogOptionLong]

// ----- Server options -----

export type ServerOptions<P extends number = number, H extends string = string> = {
	/** Server port to run on (default=`3000`) */
	port: P
	/** Server host to run on (default=`"localhost"`) */
	host: H
}

// ----- Flag -----

export type FlagValue = "none" | "optional" | "required"
export type FlagValueArray = ("required" | "optional")[]
export type FlagValueForArray = "optional" | "required"
export type FlagValueUnion = FlagValue | FlagValueArray | Readonly<FlagValueArray>

export type FlagParameterType = {
	required: `<${string}>`
	optional: `[${string}]`
}

type FlagHandlerParam<T extends FlagValueUnion> = T extends FlagValue
	? T extends "required"
		? [value: string]
		: T extends "optional"
			? [value?: string]
			: []
	: T extends FlagValueArray
		? {
				[K in keyof T]: T[K] extends "required"
					? string
					: T[K] extends "optional"
						? string | undefined
						: string
			}
		: []

type FlagParameter<T extends FlagValueUnion> = T extends FlagValue
	? T extends "required"
		? FlagParameterType["required"]
		: T extends "optional"
			? FlagParameterType["optional"]
			: T extends "none"
				? ""
				: string
	: {
			[K in keyof T]: T[K] extends "required"
				? FlagParameterType["required"]
				: T[K] extends "optional"
					? FlagParameterType["optional"]
					: FlagParameterType["required"] | FlagParameterType["optional"]
		}

export type Flag<T extends FlagValueUnion> = {
	short?: string
	long: string
	value: T
	parameter: FlagParameter<T>
	description: string
	extendedDescription: string
	handler: (...args: FlagHandlerParam<T>) => void
}

// ----- Params -----

export type LogDependency = "info" | "error" | "warning" | LogLevel | LogOptionLongCombination

export type ChechValidPetPetParams = {
	shift?: string
	resize?: string
	size?: string
	gifsize?: string
	fps?: string
	squeeze?: string
	objects?: string
}

export type Resolve<T = any> = (value: T | PromiseLike<T>) => void

// ------ Gifs/Images ------

/** Object for configuring cache in code and filesystem */
export type Cache = {
	/** Cache configuration for GIFs */
	gif: {
		/** Operations with queue */
		queue: {
			/** Add the generation task to queue with fething avatar */
			addWithAvatar: (
				hash: Hash,
				params: Partial<PetPetParams>,
				size?: number,
			) => Promise<Uint8Array>
			/** Add the generation task to queue */
			add: (hash: Hash, gif: Uint8Array, params: Partial<PetPetParams>) => Promise<Uint8Array>
			/** Check if generation task is in the queue */
			has: (hash: Hash) => boolean
			/** Get the promise with GIF generation task */
			get: (hash: Hash) => Promise<Uint8Array> | undefined
		}

		/** Cache configuration for GIFs in code */
		code: {
			/** Sets the PetPet object to map and returns result of the operation as a boolean */
			set: (petpet: PetPet) => boolean
			/** Returns the PetPet object from map */
			get: (hash: Hash) => PetPet | undefined
			/** Checks if PetPet object exists in map */
			has: (hash: Hash) => boolean
			/** Deletes the PetPet object from map and returns result of the operation as a booleana (`true` = success, `false` = failure) */
			remove: (hash: Hash) => boolean
			/** Chechs if PetPet object with given hash exeeded cache time (`true` = exeeded, `false` = not exeeded) */
			checkCacheTime: (hash: Hash) => boolean
			/** Array of all hashes in cache */
			hashes: Array<Hash>
			/** Clear the cache from all PetPet objects, and return a number of how many were deleted */
			clear: () => number
		}
		/** Cache configuration for GIFs in filesystem */
		fs: {
			/** Writes the GIF and JSON files to the `./cache/gif` directory and returns an always-resolving promise with result of the operation (`true` = success, `false` = failure)
			 * @returns {AlwaysResolvingPromise<boolean>} Always-resolving Promise with result of the operation (`true` = success, `false` = failure) */
			set: (petpet: PetPet) => AlwaysResolvingPromise<boolean>
			/** Reads the `./cache/gif` directory, checks if GIF file with given hash exists, and returns an always-resolving promise with the result
			 * @returns {AlwaysResolvingPromise<Buffer | undefined>} Always-resolving Promise with result */
			get: (hash: Hash) => AlwaysResolvingPromise<Uint8Array | undefined>
			/** Checks the `./cache/gif` directory for a GIF with given hash */
			has: (hash: Hash) => boolean
			/** Removes the GIF and JSON files from `./cache/gif` directory and returns result of the operation as a booleana (`true` = success, `false` = failure)
			 * @returns {boolean} result of the operation (`true` = success, `false` = failure) */
			remove: (hash: Hash) => boolean
			/** Reands `./cache/gif` directory, checks if JSON file with given hash exists, reads the file, and checks if timestamp exeeded cache time (`true` = exeeded, `false` = not exeeded)
			 * @returns {AlwaysResolvingPromise<boolean>} Always-resolving Promise with the result (`true` = exeeded, `false` = not exeeded) */
			checkCacheTime: (hash: Hash) => AlwaysResolvingPromise<boolean>
			/** Reands `./cache/gif` directory, and checks if both GIF and JSON files with given hash exists (`true` = exists, `false` = one/both files does not exist) */
			checkSafe: (hash: Hash) => boolean
			/** Array of all hashes in cache */
			hashes: Array<Hash>
			/** Clear the cache from all GIFs and JSON files, and return a number of how many were deleted (pairs: GIF + JSON)
			 * @returns {number} Amount of deleted `GIF + JSON` pairs */
			clear: () => number
		}
	}
	/** Cache configuration for avatars */
	avatar: {
		/** Operations with queue */
		queue: {
			/** Add the fetch task promise to the queue, and return this task */
			add: (id: string, size?: number) => Promise<Uint8Array>
			/** Check if fetching task is in the queue */
			has: (id: string) => boolean
			/** Get the promise with avatar fetching process */
			get: (id: string) => Promise<Uint8Array> | undefined
		}
		/** Cache configuration for avatars in code */
		code: {
			/** Sets the Avatar object to map and returns result of the operation as a boolean (`true` = success, `false` = failure)*/
			set: (avatar: Avatar) => boolean
			/** Returns the Avatar object from map */
			get: (id: string) => Avatar | undefined
			/** Checks if Avatar object exists in map */
			has: (id: string) => boolean
			/** Deletes the Avatar object from map and returns result of the operation as a booleana (`true` = success, `false` = failure) */
			remove: (id: string) => boolean
			/** Chechs if GIFs in code cache needs this avatar or not (`true` = needs, `false` = not needs) */
			checkDependencies: (id: string) => boolean
			/** Array of all IDs in cache */
			IDs: Array<string>
			/** Clear the cache from all Avatar objects, and return a number of how many were deleted */
			clear: () => number
		}
		/** Cache configuration for avatars in filesystem */
		fs: {
			/** Writes the PNG files to the `./cache/avatar` directory and returns an always-resolving promise with result of the operation (`true` = success, `false` = failure)
			 * @returns {AlwaysResolvingPromise<boolean>} Always-resolving Promise with result of the operation (`true` = success, `false` = failure) */
			set: (avatar: Avatar) => AlwaysResolvingPromise<boolean>
			/** Reads the `./cache/avatar` directory, checks if PNG file with given id exists, and returns an always-resolving promise with the result
			 * @returns {AlwaysResolvingPromise<Buffer | undefined>} Always-resolving Promise with result */
			get: (id: string) => AlwaysResolvingPromise<Uint8Array | undefined>
			/** Checks the `./cache/avatar` directory, and if PNG with given id exists - returns an always-resolving promise as a result */
			has: (id: string) => boolean
			/** Removes the PNG files from `./cache/avatar` directory and returns result of the operation as a booleana (`true` = success, `false` = failure)
			 * @returns {boolean} result of the operation (`true` = success, `false` = failure) */
			remove: (id: string) => boolean
			/** Reands `./cache/gif` directory, and checks if GIF file with given id in it's name exists (`true` = needs, `false` = not needs)
			 * @returns {AlwaysResolvingPromise<boolean>} Always-esolving Promise with the result (`true` = needs, `false` = not needs) */
			checkDependencies: (id: string) => AlwaysResolvingPromise<boolean>
			/** Array of all IDs in cache */
			IDs: Array<string>
			/** Clear the cache from all PNG files, and return a number of how many were deleted
			 * @returns {number} Amount of deleted `PNG` files */
			clear: () => number
		}
	}
}

export type Stats = {
	cache: {
		readonly type: AllGlobalConfigOptions["cacheType"]
		gif: {
			readonly inCache: number
			readonly processing: number
		}
		avatar: {
			readonly inCache: number
			readonly processing: number
		}
	}
	request: {
		routes: string[]
	}
	response: {
		average: {
			readonly fromScratch: number
			readonly fromCache: number
		}
		routes: {
			"/:id": {
				successful: number
				failed: number
				total: number
			}
			"/avatar/:id": {
				successful: number
				failed: number
				total: number
			}
		}
		successful: number
		failed: number
		total: number
	}
}

export type HashPart = string
export type HashTwoParameters = `${string}x${string}`
export type UID = string
export type PetPetObject = PetPetParams["objects"]
export type Hash =
	`${UID}-${HashTwoParameters}-${HashTwoParameters}-${HashPart}-${HashPart}-${HashPart}-${HashPart}-${PetPetObject}`

export type PetPetType = {
	hash: Hash
	id: string
	lastSeen: number
	gif: Uint8Array
}

export type AvatarType = {
	avatar: Uint8Array
	id: string
}

export type PetPets = Map<Hash, PetPet>
export type Avatars = Map<string, Avatar>
export type AvatarQueue = Map<string, Promise<Uint8Array>>
export type PetPetQueue = Map<Hash, Promise<Uint8Array>>
export type PetPetParams = {
	/** Shift the base image by `X` pixels on the X axis (horizontal) (default=`0`px) */
	shiftX: number
	/** Shift the base image by `Y` pixels on the Y axis (vertical) (default=`0`px) */
	shiftY: number
	/** Size of the base image (positive integer) (default=`80`px) */
	size: number
	/** Size of the GIF (positive integer) (default=`80`px) */
	gifsize: PositiveNumber
	/** Desire FPS for GIF (default=`16`)
	 * @see https://www.fileformat.info/format/gif/egff.htm */
	fps: RangeType<1, 50>
	/** Resize image on X axis from center (default=`0`px) */
	resizeX: number
	/** Resize image on Y axis from center (default=`0`px) */
	resizeY: number
	/** Squeeze factor. How mush to squeeze the image in the middle of the animation (hand down) (default=`15`px) */
	squeeze: number
	/** What objects to include in GIF: only `"hand"`, only `"avatar"`, or `"both"` (default=`"both"`) */
	objects: "hand" | "avatar" | "both"
}
