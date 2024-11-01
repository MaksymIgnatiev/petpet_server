if (process.argv[1].match(/genConfig(.ts)?$/))
	console.log(
		error(
			`File ${green("@/src/genConfig.ts")} is a library file and is not intended to be run directly`,
		),
	),
		process.exit()

var env =
		"# ENV configuration file\n# Use 'petpet_' prefix for specifying all options. Ex: petpet_cache, petpet_errors\n",
	toml = "# Toml configuration file\n"

import path from "path"
import { error, green, hasNullable } from "./functions"

type GetDescriptionObjectForType<T extends object> = {
	[Key in keyof T]?: string
}

export function genConfig<T extends "toml" | "env">(type: T) {
	if (hasNullable(type)) type = "toml" as T
	Bun.write(
		Bun.file(
			path.join(
				__dirname,
				`../${type === "toml" ? "config.toml" : ".env"}`,
			),
		),
		type === "toml" ? toml : env,
	)
}

function addPropToEnv(prop: string, decsription: string) {
	env += `\n\n# ${decsription}\n${prop}`
}

function addPropToToml(prop: string, decsription: string) {
	toml += `\n\n# ${decsription}\n${prop}`
}

function addObjToToml<T extends Record<string, any>>(
	name: string,
	obj: T,
	descriptions: { name: string } & GetDescriptionObjectForType<T>,
) {
	toml += `\n\n# ${descriptions.name}\n[${name}]`
	for (var [key, value] of Object.entries(obj)) {
		if (descriptions[key]) toml += `\n# ${descriptions[key]}`
		toml += `\n${key} = ${value}`
	}
}
function addObjToEnv<T extends Record<string, any>>(
	name: string,
	obj: T,
	descriptions: { name: string } & GetDescriptionObjectForType<T>,
) {
	env += `\n\n# ${descriptions.name}`
	for (var [key, value] of Object.entries(obj)) {
		if (descriptions[key]) toml += `\n# ${descriptions[key]}`
		toml += `\n${name}_${key}=${value}`
	}
}

addPropToEnv("cache_time=900000", "Cache time in ms")
