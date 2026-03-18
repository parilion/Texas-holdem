import { useState } from 'react'
import './Lobby.css'

export default function Lobby({ onCreateRoom, onJoinRoom, error, kickMessage, onClearKickMessage }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState(null) // 'create' | 'join'

  const handleCreate = () => {
    if (!name.trim()) return alert('请输入昵称')
    onCreateRoom(name.trim())
  }

  const handleJoin = () => {
    if (!name.trim()) return alert('请输入昵称')
    if (!code.trim()) return alert('请输入房间号')
    onJoinRoom(code.trim().toUpperCase(), name.trim())
  }

  return (
    <div className="lobby">
      <h1>♠ 德州扑克 ♠</h1>
      {kickMessage && (
        <div className="kick-notice">
          {kickMessage}
          <button className="kick-close" onClick={onClearKickMessage}>×</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="input-group">
        <input
          placeholder="输入你的昵称"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={12}
        />
      </div>
      {!mode && (
        <div className="buttons">
          <button className="btn-create" onClick={() => setMode('create')}>创建房间</button>
          <button className="btn-join" onClick={() => setMode('join')}>加入房间</button>
        </div>
      )}
      {mode === 'create' && (
        <div className="buttons">
          <button onClick={handleCreate}>确认创建</button>
          <button onClick={() => setMode(null)}>返回</button>
        </div>
      )}
      {mode === 'join' && (
        <div className="join-form">
          <input
            placeholder="输入房间号（6位）"
            value={code}
            onChange={e => setCode(e.target.value)}
            maxLength={6}
          />
          <div className="buttons">
            <button onClick={handleJoin}>加入</button>
            <button onClick={() => setMode(null)}>返回</button>
          </div>
        </div>
      )}
    </div>
  )
}
