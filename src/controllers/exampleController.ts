import type { Request, Response } from "express"
import * as queries from "@/queries/exampleQueries.js"

/* -------------------------------------------------
   Request Type Definitions
---------------------------------------------------*/

// Query: for GET /items
interface GetItemsQuery {
  limit?: string
  search?: string
}

// Body: for POST /items
interface CreateItemBody {
  title: string
  body: string
}

// Body: for PUT /items/:id
interface UpdateItemBody {
  title?: string
  body?: string
}

// Params: for routes with /:id
interface IdParam {
  id: string
}

/* -------------------------------------------------
   Controller Implementations
---------------------------------------------------*/

export async function getItems(
  req: Request<unknown, unknown, unknown, GetItemsQuery>,
  res: Response
) {
  const { limit, search } = req.query

  const data = await queries.getExampleItems(
    limit ? parseInt(limit) : undefined,
    search
  )

  res.json(data)
}

export async function postItem(
  req: Request<unknown, unknown, CreateItemBody>,
  res: Response
) {
  const { title, body } = req.body
  const newItem = await queries.createExampleItem(title, body)
  res.json(newItem)
}

export async function putItem(
  req: Request<IdParam, unknown, UpdateItemBody>,
  res: Response
) {
  const id = parseInt(req.params.id)
  const { title, body } = req.body
  const updated = await queries.updateExampleItem(id, title, body)
  res.json(updated)
}

export async function deleteItem(
  req: Request<IdParam>,
  res: Response
) {
  const id = parseInt(req.params.id)
  const msg = await queries.deleteExampleItem(id)
  res.json(msg)
}
