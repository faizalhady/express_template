import express from 'express';
import { getUsers, testMain } from '../controllers/mainController.js';

const router = express.Router();

router.get("/", testMain);
router.get("/getUsers", getUsers);


export default router;