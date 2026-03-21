import { useState } from 'react'

export default function ReplenishPanel({ onReplenish, onLeaveRoom }) {
  const [amount, setAmount] = useState('')

  const handleChange = (e) => {
    const raw = e.target.value
    if (raw === '') { setAmount(''); return }
    const num = parseInt(raw, 10)
    if (isNaN(num) || num < 1) { setAmount(1); return }
    setAmount(Math.min(1000, num))
  }

  const parsed = parseInt(amount, 10)
  const isValid = !isNaN(parsed) && parsed >= 1 && parsed <= 1000

  return (
    <div className="replenish-overlay">
      <div className="replenish-panel">
        <div className="replenish-title">💰 筹码不足</div>
        <div className="replenish-desc">请选择补充筹码或退出房间</div>
        <div className="replenish-form">
          <input
            type="number"
            min={1}
            max={1000}
            value={amount}
            onChange={handleChange}
            placeholder="输入金额（1 - 1000）"
            className="replenish-input"
          />
        </div>
        <div className="replenish-actions">
          <button
            className="replenish-btn"
            onClick={() => onReplenish(parsed)}
            disabled={!isValid}
          >
            补充筹码
          </button>
          <button className="replenish-leave-btn" onClick={onLeaveRoom}>
            退出房间
          </button>
        </div>
      </div>
    </div>
  )
}
