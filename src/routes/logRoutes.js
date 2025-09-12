import express from "express";
import { getLogs, testLog, testLog2 } from "../controllers/logController.js";


const router = express.Router();

router.get("/", testLog);
router.get("/2", testLog2);
router.get("/getLogs", getLogs);

export default router;