fileNotForRunning()

type ObjDescriptions = FilterObjectProps<typeof config, Record<string, any>>
var toml = "",
	/** Pattern for default value anotation inside comments. If spesified - will be replaced. If not - will be appended to the end in silgle lines (not the multiple ones) */
	defaultValueRegex = /<d>/,
	config: {
		[K in keyof BaseConfigOptions]: BaseConfigOptions[K] extends Record<string, any>
			? { description: string } & {
					[V in keyof BaseConfigOptions[K]]: string
				}
			: string
	} = {
		accurateTime: "Enable or disable accurate time marks",
		alternateBuffer:
			"Use an alternate buffer to output all logs <d>\n" +
			"Like a normal window, only provided at the shell level, which is not related to the existing one\n" +
			"The shell can get cluttered after a long period of work, so it is strongly recommended to enable an alternate buffer to prevent this",
		avatars: "Enable or disable avatar caching",
		cacheTime: "Cache duration in milliseconds",
		cacheCheckTime: "Interval to check cache validity in milliseconds",
		cache: "Enable or disable caching",
		cacheType: "Type of the cache to save ('code' | 'fs' | 'both')",
		compression: "Use compression to store all cache in code in compressed format or not",
		clearOnRestart:
			"Clear the stdout from previous logs on server restart due to changes in config file",
		errors: "Enable or disable error logging (affect only after parsing flags)",
		logFeatures: "Log logging features on startup/restart",
		permanentCache:
			"Keep the cache permanently (`cacheTime` does nothing, if `cache` == `false` - overrides)",
		quiet: "Run in quiet mode, suppressing all output (litteraly all output). Affects only runtime, not the flag parsing stage",
		timestamps: "Enable timestamps in logs",
		timestampFormat:
			"Format for timestamps in logs (see `configuration.md` file for format options)",
		warnings: "Enable or disable warnings (affect only after parsing flags)",
		watch: "Watching the config file for changes, and do a restart on change (creation, content change, removal) <d>\nEnable if you want to make changes and at the same time apply changes without restarting the server maualy,\nor if you need to change parameters often",
		verboseErrors: "Show full errors on each error during runtime",
		logOptions: {
			description: "Options for logging stuff",
			rest: "Log REST API requests/responses",
			gif: "Log GIF related info (creation/availability in cache/repaiting/etc.)",
			params: "Log REST parameters for the GIF",
			cache: "Log cache actions (how many was deleted/repaired/etc.)",
			watch: "Log when server restarted due to `watch` global option when config file changed (`watch` global option needs to be enabled)",
		},
		server: {
			description: "Options for server",
			port: "Port for the server",
			host: "Host for the server",
		},
	}

import { join } from "path"
import { fileNotForRunning, memoize } from "./functions"
import type {
	AllGlobalConfigOptions,
	BaseConfigOptions,
	FilteredObjectConfigProps,
	FilterObjectProps,
	Values,
} from "./types"
import { globalOptionsDefault, ROOT_PATH } from "./config"

export function genConfig() {
	if (!toml.length) {
		toml += "# TOML configuration file\n"
		for (var [keyRaw, value] of Object.entries(config)) {
			var key = keyRaw as keyof typeof config
			if (typeof value === "object" && !Array.isArray(value))
				addObjToToml(key as keyof FilteredObjectConfigProps, value)
			else addPropToToml(key, config[key] as string)
		}
	}
	Bun.write(Bun.file(join(ROOT_PATH, "config.toml")), toml)
}

function formatValue(value: any) {
	return typeof value === "string" ? `'${value}'` : value
}

function defaultValue(value: any) {
	return `(default = ${value})`
}

function addPropToToml<P extends keyof AllGlobalConfigOptions>(prop: P, description: string) {
	var value = formatValue(globalOptionsDefault[prop]),
		dv = memoize(defaultValue, value),
		lines = formatDescription(description)
	toml += `\n`
	lines.forEach((line) => (toml += `${formatDefaultValue(line, dv.value, lines.length === 1)}`))
	toml += `\n${prop} = ${value}`
}

function formatDescription(description: string) {
	return description.split(/\n+/).map((e) => `\n# ${e}`)
}

function formatDefaultValue(line: string, dv: string, singleline = true) {
	return line.match(defaultValueRegex)
		? line.replace(defaultValueRegex, dv)
		: `${line}${singleline ? ` ${dv}` : ""}`
}

function addObjToToml<N extends keyof ObjDescriptions, T extends ObjDescriptions[N]>(
	name: N,
	obj: T,
) {
	var value,
		key: keyof Values<FilteredObjectConfigProps> | "description",
		dv: { readonly value: string },
		description = (config as ObjDescriptions)[name].description,
		descriptionLines = formatDescription(description)

	toml += `\n\n`
	descriptionLines.forEach((line) => (toml += line))
	toml += `\n[${name}]\n`

	for (var [keyRaw, description] of Object.entries(obj)) {
		key = keyRaw as typeof key
		value = formatValue(
			globalOptionsDefault[name][key as keyof Values<FilteredObjectConfigProps>],
		)
		dv = memoize(defaultValue, value)
		if (key !== "description") {
			descriptionLines = formatDescription(description)
			descriptionLines.forEach(
				(line) =>
					(toml += `${formatDefaultValue(line, dv.value, descriptionLines.length === 1)}`),
			)
			toml += `\n${key} = ${value}`
		}
	}
}
