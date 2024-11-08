fileNotForRunning()

import {
	globalOptionsDefault,
	setGlobalObjectOption,
	setGlobalOption,
} from "./config"
import {
	fileNotForRunning,
	green,
	isStringNumber,
	log,
	sameType,
	warning,
} from "./functions"
import { envPrefix } from "./genConfig"
import type {
	AllGlobalConfigOptions,
	BaseConfigOptions,
	FilteredObjectConfigProps,
	Values,
} from "./types"

function warningLog(text: string) {
	log("warning", warning(text))
}

export function parseEnv() {
	for (var [keyRaw, valueRaw] of Object.entries(process.env)) {
		if (keyRaw.startsWith(envPrefix)) {
			keyRaw = keyRaw.replace(envPrefix, "")
			var key = keyRaw.match(
					/[a-zA-Z]/,
				)![0] as keyof AllGlobalConfigOptions,
				value: string | number | boolean
			if (
				Object.hasOwn(globalOptionsDefault, key) &&
				key !== "useConfig"
			) {
				var obj = globalOptionsDefault[key]
				if (typeof obj === "object" && !Array.isArray(obj)) {
					var typeofObject = typeof obj
					if (typeofObject === "number") {
						if (isStringNumber(valueRaw)) {
						} else
							warningLog(
								`Option type missmatch in '.env' configuration file. Option '${green(keyRaw)}' should have type '${green(typeofObject)}', but it's not a number`,
							)
					} else if (typeofObject === "boolean") {
					} else if (typeofObject === "string") {
					}
				} else {
				}
			}
		}
	}
}

export function parseToml(obj: Record<string, any>) {
	for (var keyRaw of Object.keys(obj)) {
		var key = keyRaw as keyof typeof globalOptionsDefault
		if (globalOptionsDefault[key] !== undefined && key !== "useConfig") {
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
						if (
							sameType(GODO[propKey], prop[propKey]) &&
							Object.hasOwn(GODO, propKey)
						) {
							setGlobalObjectOption(
								key as keyof FilteredObjectConfigProps,
								prop as keyof Values<FilteredObjectConfigProps>,
								prop[propKey] as Values<
									keyof Values<FilteredObjectConfigProps>
								>,
								1,
							)
						} else if (!Object.hasOwn(GODO, propKey))
							warningLog(
								`Unknown property key in 'config.toml' configuration file on object '${green(key)}': '${green(propKey)}'`,
							)
						else
							warningLog(
								`Option type missmatch in 'config.toml'  configuration file. Property '${green(propKey)}' on object '${green(key)}' should have type '${green(typeof GODO[propKey])}', found: '${green(typeof prop[propKey])}'`,
							)
					}
				}
			} else
				warningLog(
					`Option type missmatch in 'config.toml'  configuration file. Option '${green(key)}' should have type '${green(typeof globalOptionsDefault[key])}', found: '${green(typeof prop)}'`,
				)
		} else {
			warningLog(
				`Unknown key in 'config.toml' configuration file: '${green(key)}'`,
			)
		}
	}
}
