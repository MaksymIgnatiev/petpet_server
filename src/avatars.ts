import { fileNotForRunning } from "./functions"
import type { AvatarExtensionDiscord } from "./types"

var { API_PROVIDER, API_HTTPS } = process.env

if (!API_PROVIDER && fileNotForRunning()) {
	import("./functions").then((m) => {
		console.log(m.error("API provider domain name is not set"))
		process.exit()
	})
}

/** Fetch the avatar from 3rd party API, and return a promise with resolving value: `Uint8Array` with PNG image, and rejecting value: `Responce` with response from API */
export function fetchAvatarDiscord(id: string, size?: number, ext?: AvatarExtensionDiscord) {
	return new Promise<Uint8Array>((resolve, reject) => {
		var params = [] as string[]

		size !== undefined && params.push(`size=${size}`)
		ext !== undefined && params.push(`ext=${ext}`)

		fetch(
			`http${API_HTTPS === "true" ? "s" : ""}://${API_PROVIDER}/${id}${params.length ? `?${params.join("&")}` : ""}`,
		).then(
			(res) =>
				res.ok
					? res.arrayBuffer().then((data) => resolve(new Uint8Array(data)))
					: reject(res),
			reject,
		)
	})
}
