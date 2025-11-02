// src/middleware/errorMiddleware.ts
import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();
  const statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  console.error(`
===================== ❌ ERROR LOG =====================
🕒 Time: ${timestamp}
📍 Route: ${req.method} ${req.originalUrl}
💻 IP: ${req.ip}
📦 Params: ${JSON.stringify(req.params)}
🧾 Body: ${JSON.stringify(req.body)}
📊 Status: ${statusCode}
🗒️ Message: ${err.message}
--------------------------------------------------------
${process.env.NODE_ENV === "production" ? "" : err.stack}
========================================================
  `);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    timestamp,
    path: req.originalUrl,
  });
};
