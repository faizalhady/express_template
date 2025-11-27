import dotenv from "dotenv"
import http from "http"
import { Server } from "socket.io"
import app from "./app"

dotenv.config()

const PORT = process.env.PORT || 5000

// 1. Wrap Express with HTTP server
const server = http.createServer(app)

// 2. Create Socket.IO server
export const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true,
    }
})

// 3. Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id)

    // Send message immediately when user connects
    socket.emit("test-message", "Hello from backend!")

    socket.on("disconnect", () => {
        console.log("❌ Socket disconnected:", socket.id)
    })
})

// 4. Start HTTP + Socket.IO server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
})
