fileNotForRunning()

import {
	globalOptionsDefault,
	setGlobalObjectOption,
	setGlobalOption,
} from "./config"
import { fileNotForRunning, green, log, sameType, warning } from "./functions"
import type {
	AllGlobalConfigOptions,
	FilteredObjectConfigProps,
	Values,
} from "./types"

function warningLog(text: string) {
	log("warning", warning(text))
}

function formatValue(value: any) {
	return typeof value === "string" ? `'${value}'` : value
}

function unknownObjKey(configFile: string, obj: string, key: string) {
	warningLog(
		`Unknown property key in '${configFile}' configuration file on object '${green(obj)}': '${green(key)}'`,
	)
}

function unknownKey(type: string, key: string) {
	warningLog(`Unknown key in '${type}' configuration file: '${green(key)}'`)
}

export function parseToml(obj: Record<string, any>) {
	for (var keyRaw of Object.keys(obj)) {
		var key = keyRaw as keyof AllGlobalConfigOptions
		if (Object.hasOwn(globalOptionsDefault, key) && key !== "useConfig") {
			var prop = obj[key]
			if (sameType(globalOptionsDefault[key], prop)) {
				if (
					typeof prop !== "object" &&
					!Array.isArray(prop) &&
					key !== "logOptions" &&
					key !== "server"
				) {
					setGlobalOption(key, prop, 1)
				} else {
					for (var propKeyRaw of Object.keys(prop)) {
						var propKey =
								propKeyRaw as keyof Values<FilteredObjectConfigProps>,
							GODO = globalOptionsDefault[
								key
							] as unknown as Values<FilteredObjectConfigProps>

						if (Object.hasOwn(GODO, propKey)) {
							if (sameType(GODO[propKey], prop[propKey]))
								setGlobalObjectOption(
									key as keyof FilteredObjectConfigProps,
									propKey as keyof Values<FilteredObjectConfigProps>,
									prop[propKey] as Values<
										keyof Values<FilteredObjectConfigProps>
									>,
									1,
								)
							else
								warningLog(
									`Option type missmatch in 'config.toml' configuration file. Property '${green(propKey)}' on object '${green(key)}' should have type '${green(typeof GODO[propKey])}', found: '${green(typeof prop[propKey])}', at: ${green(formatValue(prop[propKey]))}`,
								)
						} else unknownObjKey("config.toml", key, propKey)
					}
				}
			} else
				warningLog(
					`Option type missmatch in 'config.toml' configuration file. Option '${green(key)}' should have type '${green(typeof globalOptionsDefault[key])}', found: '${green(typeof prop)}', at: ${green(formatValue(prop))}`,
				)
		} else unknownKey("config.toml", key)
	}
}
