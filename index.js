import https from "@small-tech/https"
import express from "express"
import os from "os"
import * as socketIo from "socket.io"
import five from "johnny-five"

const app = express()
const hostname = "localhost"

const localIP = os
    .networkInterfaces()
    .en0.find((a) => a.family === "IPv4").address

// Set up socket server
const server = https.createServer(app)
const io = new socketIo.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transport: ["websocket"],
    },
})

// 1. Socket Map
// We'll keep track of connected sockets as "subscribers"

const subscribers = new Map()

const subscribe = (id, socket) => {
    if (subscribers.has(id)) {
        console.log(
            `Client with ID ${id} already connected. Disconnecting older client.`
        )
        unsubscribe(id)
    }
    subscribers.set(id, socket)
    console.log(`Connected to ${id}.`)
}

const unsubscribe = (id) => {
    subscribers.delete(id)
    console.log(`Disconnected from ${id}.`)
}

// 2. Arduino
// Set up arduino light state and button listeners

const board = new five.Board({ repl: false })

board.on("ready", function () {
    // Arduino ready to go
    console.log("Board ready")

    // Set up button on pin 7 and led on pin 3
    const button = new five.Button(7)
    const led = new five.Led(3)

    // Led State
    let isLedOn = false

    // Notify all subscribers when Led changes
    function emitLedStatus() {
        console.log(`Led: ${isLedOn ? "On" : "Off"}`)
        subscribers.forEach((socket) => socket.emit("status", { isLedOn }))
    }

    // Turn the Led on or off and update the state
    function toggleLed() {
        if (isLedOn) {
            led.off()
            isLedOn = false
        } else {
            led.on()
            isLedOn = true
        }
        emitLedStatus()
    }

    // Listen for button presses to toggle the Led
    button.on("press", () => {
        toggleLed()
    })

    // Runs when each client connects to the socket server
    io.on("connection", (socket) => {
        console.log("Connection")
        const { id = "DefaultSocket" } = socket.handshake.query

        // Add subscriber for each new connection
        subscribe(id, socket)

        // Listener for "toggle" event from Framer
        socket.on("toggle", () => {
            toggleLed()
        })

        // Clean up when client disconnects
        socket.on("disconnect", () => {
            unsubscribe(id)
        })
    })
})

// Start up server and log addresses for local and network
const startServer = (port = 3000) => {
    server.listen(port, "0.0.0.0", () => {
        console.log(`Listening at https://${hostname}:${port}`)
        if (localIP) console.log(`On Network at http://${localIP}:${port}`)
    })
}

startServer()
