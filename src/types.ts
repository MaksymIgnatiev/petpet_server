// ---- Utility types ----

/** Pick last type in a Union type */
export type Last<T> = (
	(T extends any ? (x: () => T) => void : never) extends (x: infer I) => void
		? I
		: never
) extends () => infer U
	? U
	: never

/** Convert Union type to tuple of types */
export type UnionToTuple<T, A extends any[] = []> = [T] extends [never]
	? A
	: UnionToTuple<Exclude<T, Last<T>>, [Last<T>, ...A]>

/** Join strings with a separator */
export type Join<
	Tuple extends string[],
	Separator extends string = "",
> = Tuple extends [infer First extends string, ...infer Rest extends string[]]
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
export type GlobalOptionPropPriority = "config" | "arguments" | "original"
export type GlobalOptionProp<T> = {
	value: T
	source: GlobalOptionPropPriority
}

/** Options for global behaviour and settings */
export type GlobalOptions = {
	/** State of the configuration (on start it's `"original"`, during restart it's in `"restart"`, and after restart it's in `"done"`) */
	state: "original" | "restart" | "done"
	/** Version of the project */
	readonly version: string
	/** Cache time to save GIF from creating one more time in this period of time (default=`15` min (`900000` ms)) */
	cacheTime: GlobalOptionProp<number>
	/** Delay to check for outdated cache gifs (default=`1` min (`60000` ms)) */
	cacheCheckTime: GlobalOptionProp<number>
	/** Supress any output to the stdout (default=`true`) */
	output: GlobalOptionProp<boolean>
	/** Use the configuration file or not (deefault=`true`) */
	useConfig: GlobalOptionProp<boolean>
	/** Run server without any output (default=`false`)*/
	quiet: GlobalOptionProp<boolean>
	/** Cache created gifs (default=`true`) */
	cache: GlobalOptionProp<boolean>
	/** Do not clean up the cache (default=`false`) */
	permanentCache: GlobalOptionProp<boolean>
	/** Cache type: `"in-code"` - store cache in the code, `"fs"` - store cache in file system, `"both"` - combine both methods (default=`"in-code"`) */
	cacheType: GlobalOptionProp<"in-code" | "fs" | "both">
	/** Cache avatars (to reduce amount of requests to API that provides avatars) (default=`true`) */
	avatars: GlobalOptionProp<boolean>
	/** Show warnings or not (default=`true`) */
	warnings: GlobalOptionProp<boolean>
	/** Show errors or not (default=`true`) */
	errors: GlobalOptionProp<boolean>
	/** Log options (`boolean`, all default=`false`) :
	 * `rest` - requests and responses
	 * `gif` - GIF creation time and message when gif was in cache
	 * `params` - request parameters
	 * `cleanup` - info about cleanup the cache
	 */
	logOptions: { [key in keyof LogOptions]: GlobalOptionProp<LogOptions[key]> }
	/** Print which log options are enabled on startup (default=`false`) */
	logFeatures: GlobalOptionProp<boolean>
}

// ----- Log Options -----
export type LogOption = LogString | LogLevel
export type LogOptions = {
	rest: boolean
	gif: boolean
	params: boolean
	cache: boolean
	"notify-on-restart": boolean
}
export type LogString = LogOptionLongCombination | LogOptionShortCombination
export type LogLevel = 0 | 1 | 2 | 3 | 4

export type LogOptionLongCombination = Combinations<LogOptionLong, ",">
export type LogOptionShortCombination = Combinations<LogOptionShort, ",">
export type LogOptionLong = keyof LogOptions
export type LogOptionShort = {
	[S in LogOptionLong]: S extends `${infer C}${infer _}` ? C : never
}[LogOptionLong]

// ----- Flag -----

export type Flag = FlagShort | FlagLong

export type FlagShortRequire = {
	l: LogLevel | Combinations<LogOptionShort, ",">
	c: number
	g?: "toml" | "env"
}
export type FlagShortNoRequire = "q" | "C" | "A" | "L" | "h" | "v"
export type FlagShort = keyof FlagShortRequire | FlagShortNoRequire

export type FlagLong = keyof FlagLongRequire | FlagLongNoRequire
export type FlagLongRequire = {
	log: LogLevel | Combinations<LogOptionLong, ",">
	"cache-time": number
	"gen-config"?: "toml" | "env"
}
export type FlagLongNoRequire =
	| "quiet"
	| "no-cache"
	| "no-avatars"
	| "log-features"

export type GetFlagProp<F extends Flag> = F extends FlagShort
	? F extends "l" | "log"
		? LogOption
		: F extends "c" | "cache-time"
			? number
			: F extends "g" | "gen-config"
				? FlagShortRequire["g"]
				: never
	: never

export type FlagContext = "log" | "cache-time" | "gen-config"

// ----- Params -----

export type ChechValidParamsParam = {
	userID: string
	shift?: string
	resize?: string
	size?: string
	fps?: string
	squeeze?: string
}

export type User = {
	hash: string
	id: string
	lastSeen: number
	hasImage: boolean
	gif: Buffer
}

export type Users = Record<string, User>

export type PetPetParams = {
	/** Shift the base image by `X` pixels on the X axis (vertical) (default=`0`px) */
	shiftX?: number
	/** Shift the base image by `Y` pixels on the Y axis (horizontal) (default=`0`px) */
	shiftY?: number
	/** Size of the base image (positive integer) (default=`80`px) */
	size?: number
	/** Desire FPS for gif (default=`16`)
	 * @see https://www.fileformat.info/format/gif/egff.htm */
	fps?: number
	/** Resize image on X axis (default=`0`px) */
	resizeX?: number
	/** Resize image on Y axis (default=`0`px) */
	resizeY?: number
	/** Squeeze factor. How mush to squeeze the image in the middle of the animation (hand down) (default=`15`px) */
	squeeze?: number
}

export type Avatars = Record<string, Buffer>

// ----- Config files types -----
export type TOMLConfig = Partial<{
	cache_time: number
	cache: boolean
	avatars: boolean
	watch: boolean
	quiet: boolean
	warnings: boolean
	errors: boolean
	log_options: LogOptions
	server: { port?: string; host?: string }
}>
