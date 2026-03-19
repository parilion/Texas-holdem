import { useState, useEffect, useRef } from 'react'

const EMOJIS = ['😀', '😃', '😄', '😁', '🤣', '😂', '🙂', '🙃', '😉', '😍', '🤔', '😎', '🥳', '😢', '😡', '😱', '👋', '👍', '👎', '❤️']

export default function ChatBox({ messages, onSendMessage, myId }) {
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const messagesEndRef = useRef(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    onSendMessage(input)
    setInput('')
    setShowEmoji(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const insertEmoji = (emoji) => {
    setInput(prev => prev + emoji)
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">暂无消息</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.playerId === myId ? 'my-message' : ''}`}>
              <div className="chat-message-header">
                <span className="chat-sender">{msg.playerName}</span>
                <span className="chat-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="chat-content">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <input
            type="text"
            className="chat-input"
            placeholder="说点什么..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="chat-emoji-btn" onClick={() => setShowEmoji(!showEmoji)}>😀</button>
          <button className="chat-send-btn" onClick={handleSend}>发送</button>
        </div>

        {showEmoji && (
          <div className="chat-emoji-panel">
            {EMOJIS.map(emoji => (
              <button key={emoji} className="emoji-btn" onClick={() => insertEmoji(emoji)}>{emoji}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
