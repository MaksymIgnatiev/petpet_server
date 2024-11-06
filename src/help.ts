export var helpFlags = [
	"flags",
	"log_options",
	"timestamp_format",
	"sections",
] as const
var terminalWidth = process.stdout.columns || 80,
	optionsColumnWidth = 35 as const,
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
import { flagObjects, setupFlagHandlers } from "./flags"
import { error, green, warning } from "./functions"
type FlagRest = [string | string[], string] | string
type Section<
	T extends string | string[] = string,
	V extends FlagRest = FlagRest,
> = Map<T, V>

if (process.argv[1].match(/help(.ts)?$/)) {
	if (process.argv[2] === "-f") {
		// Running this file directly will not load the entry point to process flags => less CPU usage :)

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
	/** indentation for all options (leading characters) */
	private static indent = "  " as const
	private key = new FormatedOption("")
	private props: string = ""
	private descriptionText: string = ""
	private keyWidth: number
	private descriptionWidth: number
	private stdoutWidth: number

	constructor(
		optionColumnWidth: number = optionsColumnWidth,
		stdoutWidth: number = terminalWidth,
	) {
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
			fullKey = CLIOption.indent + this.key.value.formated + propsText,
			fullKeyRaw = CLIOption.indent + this.key.value.raw + propsText,
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
		var words = text.match(/[^ ]+/g) ?? [text],
			// raw version without ansi escape codes
			rawWords = words.map((w) => w.replace(/\u001b\[\d+m/g, "")),
			lines: string[] = [],
			currentLine = "",
			currentLineLen = 0
		for (var i = 0; i < words.length; i++) {
			if (
				currentLineLen + rawWords[i].length + 1 >=
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
		if (currentLine || lines.length === 0) lines.push(currentLine)
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

function formatOptions(optionList: string[]): FormatedOption {
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

function printFlags(extended = false) {
	createCLISection(
		"FLAGS",

		(() => {
			setupFlagHandlers()
			return flagObjects.reduce((a, c) => {
				var parameter = [],
					value = [],
					description = ""
				if (c.short) parameter.push(`-${c.short}`)
				if (c.parameter) value.push(c.parameter)

				description = extended
					? c.extendedDescription || c.description
					: c.description

				parameter.push(`--${c.long}`)
				value.push(description)
				a.set(
					parameter,
					(value.length === 1 ? value[0] : value) as FlagRest,
				)
				return a
			}, new Map<string[], FlagRest>())
		})(),

		[
			`You can combine flags that don't require a value into a sequense of flags. Ex: '${green("-LCAq")}'`,
		],
	).print()
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
	if (section === "flags") flags = true
	if (section === "log_options") logOptions = true
	if (section === "sections") sections = true
	if (section === "timestamp_format") timestamps = true
	if (section && !helpFlags.includes(section))
		console.log(error(`Unknown help section: ${green(section)}`))

	!section && printFlags()

	flags && printFlags(true)
	logOptions && printLogOptions()
	sections && printSections()
	timestamps && printTimespampOptions()

	!section &&
		console.log(
			`\nYou can watch a spesific section of the help page by running '${green("bun start -h/--help {SECTION_NAME}")}' or '${green("bun run help {SECTION_NAME}")}'\nAvailable sections: ${helpFlags.map(green).join(", ")}`,
		)
}
