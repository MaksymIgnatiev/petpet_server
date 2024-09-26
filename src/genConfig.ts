var env = "# ENV configuration file\n",
	toml = "# Toml configuration file\n"

import path from "path"

type GetDescriptionObjectForType<T extends object> = {
	[Key in keyof T]?: string
}

export function genConfig<T extends "toml" | "env">(type: T) {
	Bun.write(
		Bun.file(
			path.join(
				__dirname,
				`../${type === "toml" ? "config.toml" : ".env"}`,
			),
		),
		type === "toml" ? toml : env,
	)
	process.exit()
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
