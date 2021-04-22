import WebSocket from 'ws'
import http from 'http'
import RPiGPIOButtons from 'rpi-gpio-buttons'

let _wss = null

const alt = [26,24,21,19,23,32]
const pins = [7,8,9,10,11,12]

let buttons = new RPiGPIOButtons( { pins } )

buttons.on('pressed', pin => inform( pin, 'something', true ) )
buttons.on('released', pin => inform( pin, 'something', false ) )

const wss = async () => {

	if (_wss) return _wss

	_wss = new WebSocket.Server( { port: 8765 } )

	console.log('creating websocket server: 8765')

	_wss.on('connection', function connection(ws) {

		const addr = ws._socket.address()
		console.log(`[websockets] 🌐 ✅  connection made: ${addr.address} ${addr.port}"`)

		ws.on('message', function incoming(message) {
			console.log('received: %s', message)
		})

		inform( 0, 'info', 'connected to client')
	})

}
const inform = async ( pid, type, message, extra ) => {

	if (!_wss) await wss()

	const msg = typeof( message ) == 'object' || typeof( message ) == 'array' ? JSON.stringify( message ) : message
	console.log(`[inform] ${type}  🌐  ${pid}: "${msg}"`, extra || '')
	_wss.clients.forEach(function each(client) {
	  if (client.readyState === WebSocket.OPEN) {
	    client.send( JSON.stringify( { pid, type, msg } ) )
	  }
	})
}

wss()

process.stdin.resume()