import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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

/* -------------------------------------------------
   ✅ CORS Configuration (MUST come before routes)
---------------------------------------------------*/
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Vite dev
      "http://localhost:3000", // CRA fallback
    ],
    credentials: true,
  })
);

/* -------------------------------------------------
   ✅ API Routes
---------------------------------------------------*/
app.use("/api/example", exampleRoutes);
app.use("/api/health", healthRoute);

/* -------------------------------------------------
   🚫 404 Catcher
---------------------------------------------------*/
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

/* -------------------------------------------------
   ❗ Centralized Error Handler
---------------------------------------------------*/
app.use(errorHandler);

export default app;
