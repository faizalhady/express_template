import type { Request, Response, NextFunction } from "express";
import * as queries from "@/queries/exampleQueries";
import { sendSuccess } from "@/utils/responseHandler";

/* -------------------------------------------------
   Request Type Definitions
---------------------------------------------------*/

// Query: for GET /items
interface GetItemsQuery {
  limit?: string;
  search?: string;
}

// Body: for POST /items
interface CreateItemBody {
  title: string;
  body: string;
}

// Body: for PUT /items/:id
interface UpdateItemBody {
  title?: string;
  body?: string;
}

// Params: for routes with /:id
interface IdParam {
  id: string;
}

/* -------------------------------------------------
   Controller Implementations
---------------------------------------------------*/

export async function getItems(
  req: Request<unknown, unknown, unknown, GetItemsQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const { limit, search } = req.query;
    const data = await queries.getExampleItems(
      limit ? parseInt(limit) : undefined,
      search
    );

    return sendSuccess(res, data, "Items fetched successfully");
  } catch (err) {
    next(err);
  }
}

export async function postItem(
  req: Request<unknown, unknown, CreateItemBody>,
  res: Response,
  next: NextFunction
) {
  try {
    const { title, body } = req.body;
    const newItem = await queries.createExampleItem(title, body);

    return sendSuccess(res, newItem, "Item created successfully");
  } catch (err) {
    next(err);
  }
}

export async function putItem(
  req: Request<IdParam, unknown, UpdateItemBody>,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseInt(req.params.id);
    const { title, body } = req.body;
    const updated = await queries.updateExampleItem(id, title, body);

    return sendSuccess(res, updated, "Item updated successfully");
  } catch (err) {
    next(err);
  }
}

export async function deleteItem(
  req: Request<IdParam>,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseInt(req.params.id);
    const msg = await queries.deleteExampleItem(id);

    return sendSuccess(res, msg, "Item deleted successfully");
  } catch (err) {
    next(err);
  }
}
