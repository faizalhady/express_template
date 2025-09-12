import sql from "mssql"


const mainDbConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_MAIN_DB,
    port: parseInt(process.env.SQL_PORT, 10),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}

const logsDbConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_LOG_DB,
    port: parseInt(process.env.SQL_PORT, 10),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}


const getConnection = async (config) => {
    try {
        const pool = await sql.connect(config)
        return pool
    } catch (error) {
        console.error("commection to db failed")
        throw error
    }

}

export const getMainDb = () => getConnection(mainDbConfig);
export const getLogsDb = () => getConnection(logsDbConfig);