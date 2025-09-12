import express from "express";
import mainRoutes from "./routes/mainRoutes.js"
import logRoutes from "./routes/logRoutes.js"
import { logger } from "./middlewares/logger.js";

const app = express();

app.use(express.json());

//routes
app.use(logger)
app.use("/api/main", mainRoutes);
app.use("/api/log", logRoutes);

export default app; 