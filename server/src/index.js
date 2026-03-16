import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
})

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id)
  socket.on('disconnect', () => console.log('客户端断开:', socket.id))
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
