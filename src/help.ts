export var helpFlags = [
	"flags",
	"log_options",
	"timestamp_format",
	"sections",
] as const
var terminalWidth = process.stdout.columns || 80,
	optionsColumnWidth = 33 as const,
	flags: Section<FlagTuple, FlagRest> = new Map(),
	optionsLog: Section<string[], string> = new Map([
		[["0"], "No logging"],
		[["1"], "Requests and responses"],
		[["2"], "Previous + GIF creation time / When GIF was in cache"],
		[["3"], "Previous + Request parameters"],
		[["4"], "Previous + Info about cleanup the cache"],
		[["5"], "Previous + Restarting the server (all logging)"],
		[["r", "rest"], "Requests and responses"],
		[["g", "gif"], "GIF creation time / When GIF was in cache"],
		[["p", "params"], "Request parameters"],
		[["c", "cache"], "Info about cleanup the cache"],
		[
			["n", "notify-on-restart"],
			"Log all features that are enabled on startup/restart",
		],
	]),
	timestamps: Section<string, string> = new Map([
		[`S`, "milliseconds (from last second)"],
		[`s`, "seconds (from last minute)"],
		[`m`, "minutes (from last hour)"],
		[`h`, "hours (24h format, 12:00, 13:00, 24:00, 01:00)"],
		[`H`, "hours (12h format, 12 PM,  1 PM, 12 AM,  1 AM)"],
		[`P`, "`AM`/`PM` indicator"],
		[`d`, "day (of week)"],
		[`D`, "day (of month)"],
		[`M`, "month (number)"],
		[`N`, "month (3 first letters of the month name)"],
		[`Y`, "year"],
	]),
	sections: Section<string, string> = new Map([
		["flags", "Show all available flags"],
		["log_options", "Show all available log options"],
		["sections", "Show this message"],
	])
import { error, green, warning } from "./functions"
import type {
	FlagShort as FlagShortType,
	FlagLong as FlagLongType,
	FlagMaps,
	FlagShortRequire,
	FlagArgs,
} from "./types"

type ParameterRequired = `<${string}>`
type ParameterOptional = `[${string}]`
type Parameter = ParameterRequired | ParameterOptional

type Option = string
type FlagShort = `-${FlagShortType}`
type FlagLong = `--${FlagLongType}`
type FlagTuple = [FlagShort, FlagLong]
type FlagRest = [Parameter | Parameter[], string] | string
type Section<
	T extends FlagTuple | Option[] | Option = string[],
	V extends FlagRest = FlagRest,
> = Map<T, V>

function addFullFlagOption<SF extends keyof FlagMaps, LF extends FlagMaps[SF]>(
	flagsArr: [`-${SF}`, `--${LF}`],
	...rest: FlagArgs<SF>
) {
	var options: FlagRest
	if (rest.length === 1) options = rest[0]
	else options = [rest[0], rest[1]] as FlagRest

	flags.set(flagsArr, options)
}

addFullFlagOption(
	["-h", "--help"],
	"[section]",
	`Display this help message or a spesific section (see ${green("SECTIONS")}) (alias is also '${green("bun run help")}')`,
)
addFullFlagOption(["-v", "--version"], "Display version and exit")
addFullFlagOption(["-q", "--quiet"], "Run the server without any output")
addFullFlagOption(
	["-l", "--log"],
	"<level|feature...>",
	`Log level (0-4) or custom features to log. See ${green("LOG OPTIONS")} section`,
)
addFullFlagOption(
	["-L", "--log-features"],
	"Display which log features are enabled on startup",
)
addFullFlagOption(
	["-c", "--cache-time"],
	"<ms>",
	`Set cache time to a value in miliseconds (default=${green(900000)} ms, ${green(15)} mins)`,
)
addFullFlagOption(["-C", "--no-cache"], "Do not store any cache")
addFullFlagOption(["-A", "--no-avatars"], "Do not store avatars")
addFullFlagOption(
	["-W", "--no-warnings"],
	"Do not print any warnings. This includes all warnings during runtime, excluding parsing of command line arguments",
)
addFullFlagOption(
	["-E", "--no-errors"],
	"Do not output any errors. This includes all runtime errors, excluding incorrect project startup",
)
addFullFlagOption(
	["-t", "--timestamps"],
	"[format]",
	`Include timestamps in all logging stuff, and optionaly pass the format how to output timestamp. See ${green("TIMESTAMP FORMAT")} (default=${green('"s:m:h D.M.Y"')})`,
)
addFullFlagOption(
	["-g", "--gen-config"],
	"[toml|env]",
	`Generate default config file in the root of progect (for spesific file type, if spesified) (default=${green("toml")})`,
)
addFullFlagOption(
	["-O", "--omit-config"],
	`Omit the configuration file (do not load any properties from them). It applies to both '${green("config.toml")}' and '${green(".env")}' files (if they exist)`,
)
addFullFlagOption(
	["-w", "--watch"],
	`Watch the configuration file, and do a restart on change (hierarchy: '${green("config.toml")}' > '${green(".env")}' > ${green("default")}`,
)

if (process.argv[1].match(/help(.ts)?$/)) {
	if (process.argv[2] === "-f") {
		var flag = process.argv[3]?.toLowerCase().trim()
		if (
			flag === undefined ||
			helpFlags.includes(flag as (typeof helpFlags)[number])
		)
			main(flag as (typeof helpFlags)[number])
		else console.log(error(`Unknown help section: ${green(flag)}`))
	} else
		console.log(
			warning(
				`File ${green("@/src/help.ts")} is a utility file, and is not intended to be run directly. If you realy need to run it, add '${green("-f")}' flag`,
			),
		)
}

class FormatedOption {
	#formated: string
	#raw: string
	constructor(formatedOption: string) {
		this.#formated = formatedOption
		this.#raw = formatedOption.replace(/\u001b\[\d+m/g, "")
	}
	get value() {
		return {
			raw: this.#raw,
			formated: this.#formated,
		}
	}
	get length() {
		return {
			raw: this.#raw.length,
			formated: this.#formated.length,
		}
	}
}

class CLIOption {
	private indent = "  " as const
	private key: FormatedOption
	private props: string = ""
	private descriptionText: string = ""
	private keyWidth: number
	private descriptionWidth: number
	private stdoutWidth: number
	constructor(
		optionColumnWidth: number = optionsColumnWidth,
		stdoutWidth: number = terminalWidth,
	) {
		this.key = new FormatedOption("")
		this.keyWidth = optionColumnWidth
		this.stdoutWidth = stdoutWidth
		this.descriptionWidth = stdoutWidth - optionColumnWidth
	}

	option(option: FormatedOption) {
		this.key = option
		return this
	}

	properties(value: string) {
		this.props = value
		return this
	}

	description(description: string) {
		this.descriptionText = description
		return this
	}

	build() {
		var propsText = this.props ? ` ${this.props}` : "",
			fullKey = this.indent + this.key.value.formated + propsText,
			fullKeyRaw = this.indent + this.key.value.raw + propsText,
			fullKeyPadValue = this.keyWidth + 1 - fullKeyRaw.length,
			fullKeyPad = " ".repeat(fullKeyPadValue < 0 ? 0 : fullKeyPadValue),
			readyLines = this.wrapText(this.descriptionText).map(
				(line, index) =>
					index === 0
						? fullKey + fullKeyPad + line
						: " ".repeat(
								this.stdoutWidth - this.descriptionWidth + 1,
							) + line,
			)
		return {
			get lines() {
				return readyLines
			},
			get string() {
				return readyLines.join("\n")
			},
		}
	}

	private wrapText(text: string) {
		// any word/ansi escape code exept space
		var words = text.match(/[^ ]+/g)!,
			// raw version without ansi escape codes
			rawWords = words.map((w) => w.replace(/\u001b\[\d+m/g, "")),
			lines: string[] = [],
			currentLine = "",
			currentLineLen = 0
		for (var i = 0; i < words.length; i++) {
			if (
				currentLineLen + rawWords[i].length + 2 >=
				this.descriptionWidth
			) {
				lines.push(currentLine)
				currentLine = words[i]
				currentLineLen = 0
			} else {
				currentLine += (currentLine ? " " : "") + words[i]
				currentLineLen += rawWords[i].length + (currentLine ? 1 : 0)
			}
		}
		if (currentLine) lines.push(currentLine)
		return lines
	}
}

class CLISection<Name extends string> {
	private name: Name
	private options: CLIOption[]
	private PS: string[]
	constructor(name: Name, options: CLIOption[], postScriptum: string[] = []) {
		this.name = name
		this.options = options
		this.PS = postScriptum
	}
	print() {
		console.log(`${green(this.name)}:`)
		for (var option of this.options) console.log(option.build().string)
		for (var ps of this.PS) console.log(ps)
	}
}

function formatOptions(optionList: Option[]): FormatedOption {
	return new FormatedOption(
		`${(optionList.every((e) => e.includes("--")) ? ((optionList[0] = `    ${optionList[0]}`), optionList) : optionList).map(green).join(", ")}`,
	)
}

function createCLISection<Name extends string>(
	name: Name,
	options: Section<string | string[]>,
	ps: string[] = [],
	optionWidth: number = optionsColumnWidth,
) {
	var CLIOptions: CLIOption[] = []
	for (var [key, value] of options.entries()) {
		var optionsArr: string[] = [],
			propsArr: string[] = [],
			description = ""
		if (typeof key === "string") optionsArr.push(key)
		else optionsArr = key
		if (typeof value === "string") description = value
		else {
			if (typeof value[0] === "string") propsArr.push(value[0])
			else propsArr = value[0]
			description = value[1]
		}
		CLIOptions.push(
			new CLIOption(optionWidth)
				.option(formatOptions(optionsArr))
				.properties(propsArr.join(" "))
				.description(description),
		)
	}
	return new CLISection(name, CLIOptions, ps)
}

function printFlags() {
	createCLISection("FLAGS", flags, [
		`You can combine flags that don't require a value into a sequense of flags. Ex: '${green("-LCAq")}'`,
	]).print()
}

function printLogOptions() {
	createCLISection(
		"LOG OPTIONS",
		optionsLog,
		[
			`To select custom properties, use coma to separate them. Ex: '${green("-l r,g,p,c")}'`,
		],
		25,
	).print()
}

function printTimespampOptions() {
	createCLISection(
		"TIMESTAMP FORMAT",
		timestamps,
		[
			"\nExamples:",
			`'${green("s:m:h D.M.Y")}' - seconds:minutes:hours day(of month).month(number).year`,
			`'${green("Y N d m:h")}' - year month(3 first letters of name) day(of week) minutes:hours`,
			`'${green("s/m/h")}' - seconds/minutes/hours`,
			`'${green("m:h")}' -  minutes:hours`,
		],
		9,
	).print()
}
function printSections() {
	createCLISection("SECTIONS", sections).print()
}
export default function main(section?: (typeof helpFlags)[number]) {
	var flags = false,
		logOptions = false,
		sections = false,
		timestamps = false

	!section && console.log(`Usage: ${green("bun start [FLAGS...]")}`)
	if (!section || section === "flags") flags = true
	if (section === "log_options") logOptions = true
	if (section === "sections") sections = true
	if (section === "timestamp_format") timestamps = true
	if (section && !helpFlags.includes(section))
		console.log(error(`Unknown help section: ${green(section)}`))

	flags && printFlags()
	logOptions && printLogOptions()
	sections && printSections()
	timestamps && printTimespampOptions()

	!section &&
		console.log(
			`\nYou can watch a spesific section of the help page by running '${green("bun start -h/--help {SECTION_NAME}")}' or '${green("bun run help {SECTION_NAME}")}'\nAvailable sections: ${helpFlags.map(green).join(", ")}`,
		)
}
