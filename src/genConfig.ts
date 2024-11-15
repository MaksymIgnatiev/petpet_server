fileNotForRunning()

export var envPrefix = "petpet_" as const

var env = "",
	toml = "",
	config: {
		[K in keyof BaseConfigOptions]: BaseConfigOptions[K] extends Record<
			string,
			any
		>
			? { description: string } & {
					[V in keyof BaseConfigOptions[K]]: string
				}
			: string
	} = {
		cacheTime: "Cache duration in milliseconds",
		cacheCheckTime: "Interval to check cache validity in milliseconds",
		cache: "Enable or disable caching",
		cacheType: "Type of the cache to save ('code' | 'fs' | 'both')",
		configFile:
			"Name of the configuration file ('config.toml' | 'env' | 'default' )",
		avatars: "Enable or disable avatar caching",
		warnings: "Toggle to enable or disable warnings",
		errors: "Toggle to enable or disable error logging",
		logFeatures: "Log features used in the application",
		quiet: "Run in quiet mode, suppressing most logs",
		permanentCache: "Keep the cache permanently",
		watch: "Enable or disable file watching",
		timestamps: "Enable timestamps in logs",
		timestampFormat: "Format for timestamps in logs",
		logOptions: {
			description: "Options for logging stuff",
			rest: "Log REST API requests",
			gif: "Log GIF-related activity",
			params: "Log parameters passed",
			cache: "Log cache actions",
			watch: "Log file watching actions",
		},
		server: {
			description: "Options for server",
			port: "Port for the server to run on",
			host: "Host for the server",
		},
	}

import path from "path"
import { fileNotForRunning, hasNullable } from "./functions"
import type {
	AllGlobalConfigOptions,
	BaseConfigOptions,
	FilteredObjectConfigProps,
	FilterObjectProps,
	Values,
} from "./types"
import { globalOptionsDefault, ROOT_PATH } from "./config"

export function genConfig<T extends "toml" | "env">(type: T) {
	if (hasNullable(type)) type = "toml" as T
	if (type === "toml") {
		if (!toml.length) {
			toml += "# TOML configuration file\n"
			for (var [keyRaw, value] of Object.entries(config)) {
				var key = keyRaw as keyof typeof config
				if (typeof value === "object" && !Array.isArray(value))
					addObjToToml(key as keyof FilteredObjectConfigProps, value)
				else addPropToToml(key, config[key] as string)
			}
		}
	} else if (type === "env") {
		if (!env.length) {
			env += `# ENV configuration file\n# Use '${envPrefix}' prefix for specifying all options to not make conflict with other environmenv variables. Ex: petpet_cache, petpet_errors\n# To specify object options, use dot symbol '.' to separate object name from object keys like "member access operator". Ex: petpet_logOptions.rest, petpet_server.port\n`
			for (var [keyRaw, value] of Object.entries(config)) {
				var key = keyRaw as keyof typeof config
				if (typeof value === "object" && !Array.isArray(value))
					addObjToEnv(key as keyof FilteredObjectConfigProps, value)
				else addPropToEnv(key, config[key] as string)
			}
		}
	}
	Bun.write(
		Bun.file(
			path.join(ROOT_PATH, type === "toml" ? "config.toml" : ".env"),
		),
		type === "toml" ? toml : env,
	)
}

function formatValue(value: any) {
	return typeof value === "string" ? `'${value}'` : value
}

function defaultValue(value: any) {
	return ` (default = ${value})`
}

function addPropToEnv<P extends keyof AllGlobalConfigOptions>(
	prop: P,
	decsription: string,
) {
	var value = formatValue(globalOptionsDefault[prop])
	env += `\n\n# ${decsription}${defaultValue(value)}\n${envPrefix}${prop} = ${value}`
}

function addPropToToml<P extends keyof AllGlobalConfigOptions>(
	prop: P,
	decsription: string,
) {
	var value = formatValue(globalOptionsDefault[prop])
	toml += `\n\n# ${decsription}${defaultValue(value)}\n${prop} = ${value}`
}

function addObjToToml<
	N extends keyof FilterObjectProps<typeof config, Record<string, any>>,
	T extends Record<string, any>,
>(name: N, obj: T) {
	toml += `\n\n\n# ${(config[name] as unknown as { description: string }).description}\n[${name}]\n`
	for (var [keyRaw, description] of Object.entries(obj)) {
		var key = keyRaw as Values<FilteredObjectConfigProps> | "description",
			value = formatValue(
				globalOptionsDefault[name][key as keyof typeof key],
			)
		if (key !== "description")
			toml += `\n# ${description}${defaultValue(value)}\n${key} = ${value}`
	}
}
function addObjToEnv<
	N extends keyof FilterObjectProps<typeof config, Record<string, any>>,
	T extends Record<string, any>,
>(name: N, obj: T) {
	env += `\n\n\n# ${(config[name] as unknown as { description: string }).description}\n`
	for (var [keyRaw, description] of Object.entries(obj)) {
		var key = keyRaw as Values<FilteredObjectConfigProps> | "description",
			value = formatValue(
				globalOptionsDefault[name][key as keyof typeof key],
			)
		if (key !== "description")
			env += `\n# ${description}${defaultValue(value)}\n${envPrefix}${name}.${key} = ${value}`
	}
}
