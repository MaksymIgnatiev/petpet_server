import { green, warning } from "./functions"
import { helpFlags } from "./help"

if (process.argv[1].match(/explain\.ts$/)) {
	if (process.argv[2] === "-f") {
		if (process.env.npm_config_user_agent?.includes("bun"))
			process.stdout.write("\x1b[1A\x1b[2K")
		main()
	} else {
		console.log(
			warning(
				`File ${green("./src/explain.ts")} is a utility file, and is not intended to be run directly. If you realy need to run it, add '${green("-f")}' flag`,
			),
		)
		process.exit()
	}
}

function main() {
	var info = [
		`Run the project: ${green("bun start")}`,
		`See the help page: ${green("bun run help")} (more preferable) or ${green("bun start -h")}`,
		`See specific help page section: ${green("bun run help {section}")} or ${green("bun start -h {section}")}, where ${green("section")} can be: ${helpFlags.map(green).join(", ")}`,
		`During `,
	]
	for (var text of info) console.log(text)
}