import { Router } from "express"
import { getItems, postItem, putItem, deleteItem } from "../controllers/exampleController.js"

const router = Router()

router.get("/items", getItems)
router.post("/items", postItem)
router.put("/items/:id", putItem)
router.delete("/items/:id", deleteItem)

export default router
