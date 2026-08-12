import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectToDatabase } from './server/db.js'
import apiRouter from './server/routes/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = process.env.PORT || 3000

const app = express()
app.use(express.json())
app.use('/api', (req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  next()
})
app.use('/api', apiRouter)
app.use(express.static(distDir))
// SPA fallback: let the client-side router handle unknown paths
app.use((_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

await connectToDatabase()

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
