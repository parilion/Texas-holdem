import { useGame } from './hooks/useGame'
import { getSocket } from './hooks/useSocket'
import Lobby from './components/Lobby'
import Table from './components/Table'
import './index.css'

export default function App() {
  const {
    gameState, roomId, myId, error, kickMessage, isRestoring, outCountdown,
    setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom, doReplenish,
  } = useGame()

  const handleSendChat = (content) => {
    if (!roomId || !content.trim()) return
    getSocket().emit('chat:send', { roomId, content })
  }

  if (isRestoring) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: '1.2rem', color: '#888',
      }}>
        正在恢复会话...
      </div>
    )
  }

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
      doReplenish={doReplenish}
      outCountdown={outCountdown}
      onSendChat={handleSendChat}
      error={error}
    />
  )
}
