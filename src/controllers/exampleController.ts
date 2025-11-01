import type { Request, Response } from "express"
import * as queries from "../queries/exampleQueries.js"

export async function getItems(req: Request, res: Response) {
  const { limit, search } = req.query
  const data = await queries.getExampleItems(
    limit ? parseInt(limit as string) : undefined,
    search as string
  )
  res.json(data)
}

export async function postItem(req: Request, res: Response) {
  const { title, body } = req.body
  const newItem = await queries.createExampleItem(title, body)
  res.json(newItem)
}

export async function putItem(req: Request, res: Response) {
  const id = parseInt(req.params.id)
  const { title, body } = req.body
  const updated = await queries.updateExampleItem(id, title, body)
  res.json(updated)
}

export async function deleteItem(req: Request, res: Response) {
  const id = parseInt(req.params.id)
  const msg = await queries.deleteExampleItem(id)
  res.json(msg)
}
