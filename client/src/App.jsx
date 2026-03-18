import { useGame } from './hooks/useGame'
import Lobby from './components/Lobby'
import Table from './components/Table'
import './index.css'

export default function App() {
  const { gameState, roomId, myId, error, kickMessage, setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom } = useGame()

  if (!roomId) {
    return (
      <Lobby
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        error={error}
        kickMessage={kickMessage}
        onClearKickMessage={() => setKickMessage(null)}
      />
    )
  }

  return (
    <Table
      gameState={gameState}
      myId={myId}
      roomId={roomId}
      onAction={doAction}
      onStartGame={startGame}
      onReady={doReady}
      onUnready={doUnready}
      onLeaveRoom={leaveRoom}
      error={error}
    />
  )
}
