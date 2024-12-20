fileNotForRunning()

import { fileNotForRunning } from "./functions"

/** Fetch the avatar from 3rd party API, and return a promise with resolving value: `Uint8Array` with PNG image, and rejecting value: `Responce` with response from API */
export function fetchAvatar(id: string, size?: number) {
	return new Promise<Uint8Array>((resolve, reject) => {
		fetch(`https://avatar.cdev.shop/${id}${size !== undefined ? `?size=${size}` : ""}`).then(
			(res) =>
				res.ok
					? res.arrayBuffer().then((data) => resolve(new Uint8Array(data)))
					: reject(res),
			reject,
		)
	})
}
