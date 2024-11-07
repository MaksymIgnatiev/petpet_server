fileNotForRunning()

import {
	globalOptionsDefault,
	setGlobalObjectOption,
	setGlobalOption,
} from "./config"
import { fileNotForRunning, green, log, sameType, warning } from "./functions"
import { envPrefix } from "./genConfig"
import type { FilteredObjectConfigProps, Values } from "./types"
export function parseEnv() {
	for (var [key, value] of Object.entries(process.env)) {
		if (key.startsWith(envPrefix)) {
			console.log({ key, value })
		}
	}
}

export function parseToml(obj: Record<string, any>) {
	for (var keyRaw of Object.keys(obj)) {
		var key = keyRaw as keyof typeof globalOptionsDefault
		if (globalOptionsDefault[key] !== undefined) {
			var prop = obj[key]
			if (sameType(globalOptionsDefault[key], prop)) {
				if (
					typeof prop !== "object" &&
					key !== "logOptions" &&
					key !== "server"
				) {
					setGlobalOption(key, prop, 1)
				} else {
					for (var propKeyRaw of Object.keys(prop)) {
						var propKey =
								propKeyRaw as keyof FilteredObjectConfigProps,
							GODO = globalOptionsDefault[
								key
							] as unknown as FilteredObjectConfigProps
						if (sameType(GODO[propKey], prop[propKey])) {
							setGlobalObjectOption(
								key as keyof FilteredObjectConfigProps,
								prop as keyof Values<FilteredObjectConfigProps>,
								prop[propKey] as Values<
									keyof Values<FilteredObjectConfigProps>
								>,
								1,
							)
						} else
							log(
								"warning",
								warning(
									`Option type missmatch in toml configuration file. Property '${green(propKey)}' on object '${green(GODO)}' should have type '${green(typeof GODO[propKey])}', found: '${green(typeof prop[propKey])}'`,
								),
							)
					}
				}
			} else
				log(
					"warning",
					warning(
						`Option type missmatch in toml configuration file. Option '${green(prop)}' should have type '${green(typeof globalOptionsDefault[key])}', found: '${green(typeof prop)}'`,
					),
				)
		} else {
			log(
				"warning",
				warning(
					`Unknown key in 'config.toml' configuration file: '${green(key)}'`,
				),
			)
		}
	}
}
