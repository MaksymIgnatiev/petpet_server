import type { WSMessage } from "../../src/types"

export function validateWSMessage(data: unknown): data is WSMessage {
	return typeof data === "object" && data !== null && "type" in data
}
