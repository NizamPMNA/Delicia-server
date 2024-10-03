// configraration with env. 
require('dotenv').config()

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER_NAME,
    database: process.env.DB_NAME,
    requestTimeout: 600000,
    options: {
        trustedconnection: true,
        enableArithAbort: true,
        instancename: process.env.INSTANCE_NAME,
        encrypt: false
    },
    port: Number(process.env.DB_PORT)
//     dialect: "mssql",
//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000,
//     idle: 10000
//   }
}

module.exports = config;