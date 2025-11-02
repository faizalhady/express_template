import express from "express";
import dotenv from "dotenv";
import exampleRoutes from "./routes/exampleRoute";
import healthRoute from "./routes/healthRoute";
import { connectDB } from "./config/db";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorMiddleware";

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));

// ✅ API routes
app.use("/api/example", exampleRoutes);
app.use("/api/health", healthRoute);

// ✅ 404 catcher → passes to error handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// ✅ Centralized error handler (your detailed log)
app.use(errorHandler);

export default app;
