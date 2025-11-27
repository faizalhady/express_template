import { io } from "@/server"
import type { NextFunction, Request, Response } from "express"

export function eventBridge(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json
    const originalSend = res.send

    // Intercept res.json
    res.json = function (body: any) {
        tryEmit(res)
        return originalJson.call(this, body)
    }

    // Intercept res.send (covers fallback cases)
    res.send = function (body: any) {
        tryEmit(res)
        return originalSend.call(this, body)
    }

    next()
}

function tryEmit(res: Response) {
    const meta = res.locals.eventMeta

    if (meta) {
        console.log("📡 Emitting:", meta.event, meta)
        io.emit(meta.event, meta)
    }
}
