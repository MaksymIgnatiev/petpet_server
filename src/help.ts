type Parameter = `<${string}>` | `[${string}]`
type FullOption =
	| [Option | Option[], Parameter | Parameter[], string]
	| [Option | Option[], string]
type Option = string

var terminalWidth = process.stdout.columns || 80,
	optionsColumnWidth = 25 as const,
	propsColumnWidth = 15 as const,
	flags: FullOption[] = [
		[["-h", "--help"], "Display this help message and exit"],
		[["-v", "--version"], "Display version and exit"],
		[["-q", "--quiet"], "Run the server without any output"],
		[
			["-l", "--log"],
			"<level|features...>",
			`Log level (0-4) or custom features to log. See ${green("LOG OPTIONS")} section`,
		],
		[
			["-L", "--log-features"],
			"Display which log features are enabled on startup",
		],
		[
			["-c", "--cache-time"],
			"<ms>",
			`Set cache time to a value in miliseconds (default=${green("900000")}ms, ${green("15")}mins)`,
		],
		[["-C", "--no-cache"], "Do not store any cache inside server itself"],
		[
			["-A", "--no-avatar"],
			`Do not store avatars in cache inside server itself`,
		],
		[
			["-g", "--gen-config"],
			"[toml|env]",
			`Generate default config file in the root of progect (for spesific file type, if spesified) (default=${green("toml")})`,
		],
		[
			["-O", "--omit-config"],
			`Omit the configuration file (do not load any properties from it). It applies to both '${green("config.toml")}' and '${green(".env")}' files (if they exist)`,
		],
		[
			["-w", "--watch"],
			`Watch the configuration file, and do a restart on change ('${green("config.toml")}' has more privileges than the '${green(".env")}' file. It means that if '${green("config.toml")}' file is spesified, '${green(".env")}' file will be ignored. If '${green("config.toml")}' is not spesified, '${green(".env")}' file will be used)`,
		],
	],
	optionsLog: FullOption[] = [
		["0", "No logging"],
		["1", "Requests and responses"],
		["2", "Previous + GIF creation time / When GIF was in cache"],
		["3", "Previous + Request parameters"],
		["4", "Previous + Info about cleanup the cache"],
		["5", "Previous + Restarting the server (all logging)"],
		[["r", "rest"], "Requests and responses"],
		[["g", "gif"], "GIF creation time / When GIF was in cache"],
		[["p", "params"], "Request parameters"],
		[["c", "cache"], "Info about cleanup the cache"],
		[["n", "notify-on-restart"], "Info about cleanup the cache"],
	]

class FormatedOption {
	#formated: string
	#raw: string
	constructor(formatedFlags: string) {
		this.#formated = formatedFlags
		this.#raw = formatedFlags.replace(/\u001b\[\d+m/g, "")
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
	private indent = "  "
	private key: FormatedOption
	private props: string
	private descriptionText: string
	private keyWidth: number
	private propsWidth: number
	private descriptionWidth: number
	constructor(
		optionColumnWidth: number,
		propsColumnWidth: number,
		stdoutWidth: number,
	) {
		this.key = new FormatedOption("")
		this.props = ""
		this.descriptionText = ""
		this.keyWidth = optionColumnWidth
		this.propsWidth = propsColumnWidth
		this.descriptionWidth =
			stdoutWidth - optionColumnWidth - propsColumnWidth
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
			fullKeyPad =
				(this.indent + this.key.value.raw + propsText)
					.padEnd(this.keyWidth + this.propsWidth + 1, " ")
					.match(/ +$/) ?? "",
			readyLines = this.wrapText(this.descriptionText).map(
				(line, index) =>
					index === 0
						? fullKey + fullKeyPad + line
						: " ".repeat(this.keyWidth + this.propsWidth + 1) +
							line,
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
		var words = text.split(" "),
			lines: string[] = [],
			currentLine = ""

		words.forEach((word) => {
			if (currentLine.length + word.length + 1 > this.descriptionWidth) {
				lines.push(currentLine)
				currentLine = word
			} else currentLine += (currentLine ? " " : "") + word
		})
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
		console.log(`${this.name}:`)
		for (var option of this.options) console.log(option.build().string)

		for (var ps of this.PS) console.log(ps)
	}
}

function formatOptions(optionList: Option[]): FormatedOption {
	return new FormatedOption(
		`${(optionList.every((e) => e.includes("--")) ? ((optionList[0] = `    ${optionList[0]}`), optionList) : optionList).map((f) => green(f)).join(", ")}`,
	)
}

export function green(text: string) {
	return `\x1b[32m${text}\x1b[0m`
}

function createCLISection<Name extends string>(
	name: Name,
	options: FullOption[],
	ps: string[] = [],
) {
	var CLIOptions: CLIOption[] = []
	for (var option of options) {
		var optionsArr: string[] = [],
			propsArr: string[] = [],
			description = ""
		if (option.length === 3) {
			optionsArr = typeof option[0] === "string" ? [option[0]] : option[0]
			propsArr = typeof option[1] === "string" ? [option[1]] : option[1]
			description = option[2]
		} else {
			optionsArr = typeof option[0] === "string" ? [option[0]] : option[0]
			description = option[1]
		}
		CLIOptions.push(
			new CLIOption(optionsColumnWidth, propsColumnWidth, terminalWidth)
				.option(formatOptions(optionsArr))
				.properties(propsArr.join(" "))
				.description(description),
		)
	}
	return new CLISection(name, CLIOptions, ps)
}

function printFlags() {
	createCLISection("FLAGS", flags, [
		`You can combine flags that don't require a value into a sequense of flags. Ex: ${green("'-LCAq'")}`,
	]).print()
}

function printLogOptions() {
	createCLISection("LOG OPTIONS", optionsLog, [
		`To select custom properties, use coma to separate them. Ex: ${green("'-l r,g,p,c'")}`,
	]).print()
}

export default function main() {
	console.log(`Usage: ${green("bun start [FLAGS...]")}`)
	printFlags()
	console.log("\n")
	printLogOptions()

	process.exit()
}

if (process.argv[1].includes("help.ts") && process.argv[2] === "-f")
	main()
