import { app } from './index.ts'

const port = Number(process.env.PORT) || 3001
const hostname = process.env.HOST || '127.0.0.1'
app.listen({ hostname, port })
console.info(`KING-FUN API listening on http://${hostname}:${port}`)
