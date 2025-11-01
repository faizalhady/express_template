import express from "express"
import dotenv from "dotenv"
import exampleRoutes from "./routes/exampleRoute.js"
import healthRoute from "./routes/healthRoute.js"
import { connectDB } from "./config/db.js"

dotenv.config()
connectDB()

const app = express()
app.use(express.json())
app.use("/example", exampleRoutes)
app.use("/health", healthRoute)

export default app;