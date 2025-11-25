import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { connectDB } from "./config/db";
import { errorHandler } from "./middlewares/errorMiddleware";
import areaRoute from "./routes/areaRoutes";
import bookingRoute from "./routes/bookingRoutes";
import bookingSwapRoutes from "./routes/bookingSwapRoutes";
import exampleRoutes from "./routes/exampleRoute";
import healthRoute from "./routes/healthRoute";
import jobBookingRoute from "./routes/jobBookingRoute";
import jobRoute from "./routes/jobRoute";
import plantRoute from "./routes/plantRoute";
import vendorRoute from "./routes/vendorRoute";
import workcellRoute from "./routes/workcellRoute";



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
/* -------------------------------------------------
   ✅ API Routes
---------------------------------------------------*/
app.use("/api/example", exampleRoutes)
app.use("/api/health", healthRoute)
app.use("/api/bookings", bookingRoute)
app.use("/api/areas", areaRoute)
app.use("/api/jobs", jobRoute)
app.use("/api/plants", plantRoute)
app.use("/api/vendors", vendorRoute)
app.use("/api/workcells", workcellRoute)
app.use("/api/jobs-with-booking", jobBookingRoute)
app.use("/api/bookings/swaps", bookingSwapRoutes)

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
