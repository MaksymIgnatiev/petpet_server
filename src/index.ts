// if (process.env.npm_config_user_agent?.includes("bun")) {
// 	// if it was a script - clear the line above (`$ bun run src/index.ts`)
// 	if (process.stdout.isTTY) process.stdout.write("\x1b[1A\x1b[2K") // 1A - move cursor one line up; 2K - clear the entire line
// }

import { join } from "path"
import { Stats, unwatchFile, watchFile } from "fs"
import { stdout } from "process"
import type { Server } from "bun"

import type { AlwaysResolvingPromise } from "./types"
import {
	chechCache,
	enterAlternateBuffer,
	error,
	EXIT,
	getConfig,
	green,
	info,
	log,
	verboseError,
} from "./functions"
import { getGlobalConfigOption, getGlobalOption, getServerOption, ROOT_PATH } from "./config"
import { processFlags } from "./flags"
import app from "./router"

var args = process.argv.slice(2),
	server: Server,
	/** Cleanup function to stop watching the config file */
	configWatcher: undefined | (() => void),
	intervalID: Timer,
	/** Exit function from the alternate buffer
	 * `undefined` - not in alternate buffer
	 * `function` - in alternate buffer */
	exitAlternate: undefined | (() => void),
	/** Exit the whole process with exiting alternate buffer
	 *
	 * DON'T TRY TO USE THIS FUNCTION UNLESS YOU KNOW WHAT YOU ARE DOING
	 *
	 * Basicaly, it's just a function that force exits the alternate buffer, and exit the process, so, nothing special */
	exit: undefined | (() => void)

function setupWatchConfig() {
	// Watch the root directory for changes, and if it was a config file,
	// if `useConfig` global option is enabled,
	// then start the server with `restart: true` value for indication
	// proposes to default all values, and re-load flags and config file
	var filepath = join(ROOT_PATH, "config.toml"),
		listener = (curr: Stats, prev: Stats) => {
			if (curr.mtime.getTime() === 0) {
				// File was deleted
				if (getGlobalConfigOption("useConfig")) restart("deleted")
			} else if (prev.mtime.getTime() === 0) {
				// File was created
				if (getGlobalConfigOption("useConfig")) restart("created")
			} else if (curr.mtime > prev.mtime) {
				// File was modified
				if (getGlobalConfigOption("useConfig")) restart("changed")
			}
		}
	watchFile(filepath, { interval: 1000 }, listener).on("error", (e) => {
		verboseError(
			e,
			error("Error while watching config files for change:\n"),
			error("Error while watching config files for change"),
		)
	})
	return () => unwatchFile(filepath, listener)
}

function handleCacheInterval() {
	if (intervalID) clearInterval(intervalID)
	if (getGlobalOption("cache") && !getGlobalOption("permanentCache"))
		intervalID = setInterval(chechCache, getGlobalOption("cacheCheckTime"))
}

function handleWatcher() {
	if (configWatcher) {
		configWatcher()
		configWatcher = undefined
	}
	if (getGlobalOption("watch")) {
		configWatcher = setupWatchConfig()
	}
}

function handleServer() {
	if (server) server?.stop?.()
	server = Bun.serve({
		fetch: app.fetch,
		idleTimeout: 60,
		port: getServerOption("port"),
		hostname: getServerOption("host"),
	})
}

/** Dynamicaly enter and exit alternate buffer depending on config preferences, and handle `SIGINT` / `SIGTERM` signals to exit alternate buffer */
function handleAlternateBuffer() {
	if (getGlobalOption("alternateBuffer")) {
		if (!exitAlternate) {
			exitAlternate = enterAlternateBuffer()
			exit = () => {
				if (exitAlternate) exitAlternate()
				EXIT()
			}
			process.on("SIGINT", exit)
			process.on("SIGTERM", exit)
		}
	} else {
		if (exitAlternate) {
			exitAlternate()
			process.removeListener("SIGINT", exit!)
			process.removeListener("SIGTERM", exit!)
			exitAlternate = undefined
		}
	}
}

function listening() {
	log(
		"info",
		info(server?.url ? `Listening on URL: ${green(server.url)}` : "Server is not yet started"),
	)
}

/** Process server setup after geting the config */
function processAfterConfig() {
	handleAlternateBuffer()
	handleCacheInterval()
	handleServer()
	handleWatcher()
}

async function restart(eventType: "created" | "changed" | "deleted") {
	return main(true, false).then((text) => {
		if (getGlobalOption("clearOnRestart")) stdout.write("\x1b[2J\x1b[H")
		if (text) log("info", text)
		log("watch", info(`Server restarted due to changes in config file: ${green(eventType)}`))
		listening()
	})
}

/** Process flags (if exist), try to get and parse the config file, and after all, init all other things based on the result */
function main(reload?: boolean, log?: boolean): AlwaysResolvingPromise<string>
function main(r = false, l = true): AlwaysResolvingPromise<string> {
	var printText = ""
	// Do not process anything if there are no flags => less CPU & RAM usage and faster startup time :)
	if (args.length) printText = processFlags(args)
	return getConfig(r)
		.then(processAfterConfig)
		.then(() => {
			if (printText) log("info", printText)
			// logGlobalOptions()
			if (l) listening()
		})
		.then(() => printText) as AlwaysResolvingPromise<string>
}

main()
