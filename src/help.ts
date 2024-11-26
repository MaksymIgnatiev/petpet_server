var terminalWidth = process.stdout.columns || 80

export var helpFlags = ["flags", "log_options", "timestamp_format", "sections"] as const,
	isSmallScreen = terminalWidth < 91

var flagsGap = 1,
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
		[["cache"], "Info about cleanup the cache"],
		[
			["w", "watch"],
			"inform when server restarted due to changes in cofnig file (watch global option needs to be enabled)",
		],
	]),
	timestamps: Section<string, string> = new Map([
		[`u`, "microseconds"],
		[`S`, "milliseconds "],
		[`s`, "seconds"],
		[`m`, "minutes"],
		[`h`, "hours (24h format, 12:00, 13:00, 24:00, 01:00)"],
		[`H`, "hours (12h format, 12 PM,  1 PM, 12 AM,  1 AM)"],
		[`P`, "`AM`/`PM` indicator"],
		[`d`, "day (3 first letters of the day of the week)"],
		[`D`, "day (of month)"],
		[`M`, "month (number)"],
		[`N`, "month (3 first letters of the month name)"],
		[`Y`, "year"],
	]),
	sections: Section<string, string> = new Map([
		["flags", "Show all available flags with extended descriptions"],
		["log_options", "Show log options"],
		["timestamp_format", "Show timestamp formating"],
		["sections", "Show this message"],
	])

if (process.argv[1].match(/help\.ts$/)) {
	if (process.argv[2] === "-f") {
		if (process.env.npm_config_user_agent?.includes("bun")) {
			process.stdout.write("\x1b[1A\x1b[2K")
		}
		// Running this file directly will not load the entry point to process flags => less CPU usage :)

		var flag = process.argv[3]?.toLowerCase().trim()
		if (flag === undefined || helpFlags.includes(flag as (typeof helpFlags)[number]))
			console.log(main(flag as (typeof helpFlags)[number]))
		else console.log(error(`Unknown help section: ${green(flag)}`))
	} else {
		console.log(
			warning(
				`File ${green("./src/help.ts")} is a utility file, and is not intended to be run directly. If you realy need to run it, add '${green("-f")}' flag`,
			),
		)
		process.exit()
	}
}

import { flagObjects, setupFlagHandlers } from "./flags"
import { error, green, warning } from "./functions"
type FlagRest = [string | string[], string] | string
type Section<T extends string | string[] = string, V extends FlagRest = FlagRest> = Map<T, V>

/** SS = Small Screen for short
 * return first value if screen is small. Else second
 */
export function ss<T, F>(ifTrue: T, ifFalse: F): T | F {
	return isSmallScreen ? ifTrue : ifFalse
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
	/** indentation for all options (leading characters) when terminal size is normal */
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
		optionColumnWidth = optionColumnWidth - (isSmallScreen ? CLIOption.indent.length : 0)

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
			fullKey = (isSmallScreen ? "" : CLIOption.indent) + this.key.value.formated + propsText,
			fullKeyRaw = (isSmallScreen ? "" : CLIOption.indent) + this.key.value.raw + propsText,
			fullKeyPadValue = this.keyWidth + 1 - fullKeyRaw.length,
			fullKeyPad = " ".repeat(fullKeyPadValue < 0 ? 0 : fullKeyPadValue),
			readyLines = this.wrapText(this.descriptionText).map((line, index) =>
				index === 0
					? fullKey + fullKeyPad + line
					: " ".repeat(this.stdoutWidth - this.descriptionWidth + 1) + line,
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
				currentLineLen + (currentLine ? 1 : 0) + rawWords[i].length + +!isSmallScreen >=
				this.descriptionWidth
			) {
				lines.push(currentLine)
				currentLine = words[i]
				currentLineLen = rawWords[i].length
			} else {
				currentLine += (currentLine ? " " : "") + words[i]
				currentLineLen += (currentLine ? 1 : 0) + rawWords[i].length
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
	get string() {
		// todo: return a string, not print
		var out = `${green(this.name)}:\n`
		out += this.options.map((option) => option.build().string).join("\n")
		out += this.PS.join("\n")
		return out
	}
}

function formatOptions(optionList: string[]): FormatedOption {
	return new FormatedOption(
		`${(optionList.every((e) => /[a-zA-Z]{2,}/.test(e))
			? ((optionList[0] = `${`  ${ss(optionList[0].includes("-") ? " " : "", " ")}${ss("", " ".repeat(flagsGap - +!optionList[0].includes("-")))}`}${optionList[0]}`),
				optionList)
			: optionList
		)
			.map(green)
			.join(ss(",", `,${" ".repeat(flagsGap)}`))}`,
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

function getFlagsDescription(extended = false) {
	return createCLISection(
		"FLAGS",
		(() => {
			setupFlagHandlers()
			return flagObjects.reduce((a, c) => {
				var parameter = [],
					value = [],
					description = ""
				if (c.short) parameter.push(`-${c.short}`)
				if (c.parameter) value.push(c.parameter)

				description = extended ? c.extendedDescription || c.description : c.description

				parameter.push(`--${c.long}`)
				value.push(description)
				a.set(parameter, (value.length === 1 ? value[0] : value) as FlagRest)
				return a
			}, new Map<string[], FlagRest>())
		})(),
		[
			`You can combine flags that don't require a value into a sequense of flags. Ex: '${green("-LAWEt")}'`,
		],
	).string
}

function getLogOptions() {
	return createCLISection(
		"LOG OPTIONS",
		optionsLog,
		[
			`To select specific features, use coma to separate them. Ex: '${green("-l r,g,p,c,w")}', or specify the level of logging. Ex: '${green("-l 3")}'`,
		],
		13,
	).string
}

function getTimespampOptions() {
	return createCLISection(
		"TIMESTAMP FORMAT",
		timestamps,
		[
			"\nExamples:",
			`'${green("s:m:h D.M.Y")}' - seconds:minutes:hours day(of month).month(number).year`,
			`'${green("Y N d m:h")}'   - year month(3 first letters of the month name) day(first 3 letters of the day of the week) minutes:hours`,
			`'${green("m:s:S.u")}      - minutes:seconds:milliseconds.microseconds`,
			`'${green("s/m/h")}'       - seconds/minutes/hours`,
			`'${green("m:h")}'         - minutes:hours`,
		],
		9,
	).string
}

function getSections() {
	return createCLISection("SECTIONS", sections, [], 20).string
}

export default function main(section?: (typeof helpFlags)[number]) {
	var flags = false,
		logOptions = false,
		sections = false,
		timestamps = false,
		result = "",
		add = (text: string) => (result += `${!!result ? "\n" : ""}${text}`)

	!section && add(`Usage: ${green("bun start [FLAGS...]")}`)
	if (section === "flags") flags = true
	if (section === "log_options") logOptions = true
	if (section === "sections") sections = true
	if (section === "timestamp_format") timestamps = true
	if (section && !helpFlags.includes(section))
		add(error(`Unknown help section: ${green(section)}`))

	!section && add(getFlagsDescription())

	flags && add(getFlagsDescription(true))
	logOptions && add(getLogOptions())
	sections && add(getSections())
	timestamps && add(getTimespampOptions())

	!section &&
		add(
			`\nYou can watch a spesific section of the help page by running '${green("bun start -h/--help {section}")}' or '${green("bun run help {section}")}'\nAvailable sections: ${helpFlags.map(green).join(", ")}`,
		)
	return result
}
