import { getLogsDb } from "../config/db.js";
import { getAllLogs } from "../queries/logQueries.js";

export async function getLogs(req,res) {
    try {
        const pool = await getLogsDb();
        const query = getAllLogs
        const result = await pool.request().query(query)
    } catch (err) {
        res.status(500)
        .json({
            error: "DB Logs error",
        })
    }
    
}


export function testLog(req,res) {
    res.json({
        message: "This is a test from log consdsdsoller"
})
}
export function testLog2(req,res) {
    res.json({
        message: "this is testLog22"
})
}