import { useGame } from './hooks/useGame'
import Lobby from './components/Lobby'
import Table from './components/Table'
import './index.css'

export default function App() {
  const { gameState, roomId, myId, error, createRoom, joinRoom, startGame, doAction } = useGame()

  if (!roomId) {
    return <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
  }

  return (
    <Table
      gameState={gameState}
      myId={myId}
      roomId={roomId}
      onAction={doAction}
      onStartGame={startGame}
      error={error}
    />
  )
}
