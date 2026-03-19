import { useState } from 'react'

export default function ReplenishPanel({ onReplenish }) {
  const [amount, setAmount] = useState(1000)

  const handleChange = (e) => {
    const val = parseInt(e.target.value, 10)
    if (val > 1000) {
      setAmount(1000)
    } else if (val < 1) {
      setAmount(1)
    } else {
      setAmount(val)
    }
  }

  const handleSubmit = () => {
    if (amount >= 1 && amount <= 1000) {
      onReplenish(amount)
    }
  }

  return (
    <div className="replenish-overlay">
      <div className="replenish-panel">
        <div className="replenish-title">💰 补筹</div>
        <div className="replenish-form">
          <label>
            补筹金额:
            <input
              type="number"
              min={1}
              max={1000}
              value={amount}
              onChange={handleChange}
            />
          </label>
        </div>
        <button className="replenish-btn" onClick={handleSubmit}>
          补筹
        </button>
      </div>
    </div>
  )
}
