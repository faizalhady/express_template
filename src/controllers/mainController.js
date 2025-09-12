import { getMainDb } from "../config/db.js";
import { getAllUser } from "../queries/userQueries.js";

export async function getUsers(req, res) {
    try {
        const pool = await getMainDb();
        const query = getAllUser
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "DB Main error",
        })
    }
}


export function testMain(req,res) {
    res.json({
        message: "This is a test from main controller"
})
}