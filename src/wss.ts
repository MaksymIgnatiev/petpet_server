import { WebSocketServer, WebSocket } from "ws"

export var wss = new WebSocketServer({ port: 8080 })

var clients = new Set<WebSocket>()

wss.on("connection", (ws) => {
	clients.add(ws)
	console.log(`[WSS]: new connection! ✔`)
	ws.on("message", (data, isBinary) => {
		console.log({ data, isBinary })
	})

	ws.on("close", () => {
		console.log("[WSS]: connection closed ❌")
		clients.delete(ws)
	})
})
