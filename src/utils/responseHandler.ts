//path: src/utils/responseHandler.ts

import { Response } from "express";

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = "Success",
  meta?: Record<string, any>       // <--- NEW
) => {
  // Store metadata for eventBridge
  if (meta) {
    res.locals.eventMeta = meta;   // <--- NEW
  }

  return res.status(200).json({
    success: true,
    message,
    data,
    meta: meta || null,            // optional: return meta to client
  });
};
