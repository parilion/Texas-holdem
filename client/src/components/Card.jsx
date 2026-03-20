const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RED = ['hearts', 'diamonds']
// 数字比字母矮，需要微调
const NUMERIC_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9']

export default function Card({ card, faceDown = false, small = false, dimmed = false }) {
  if (faceDown || !card) {
    return (
      <div className={`poker-card face-down ${small ? 'small' : ''}`}>
        <div className="card-back">
          <div className="card-back-pattern"></div>
        </div>
      </div>
    )
  }
  const isRed = RED.includes(card.suit)
  const isNumeric = NUMERIC_RANKS.includes(String(card.rank))
  const isDiamond = card.suit === 'diamonds'

  return (
    <div className={`poker-card ${isRed ? 'red' : 'black'} ${small ? 'small' : ''} ${isDiamond ? 'diamond-card' : ''} ${dimmed ? 'dimmed' : ''}`}>
      <div className="card-corner top-left">
        <span className={`card-rank ${isNumeric ? 'num' : ''}`}>{card.rank}</span>
        <span className={`card-suit-small ${isDiamond ? 'diamond' : ''}`}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className={`card-suit-large ${isDiamond ? 'diamond' : ''}`}>{SUIT_SYMBOL[card.suit]}</div>
    </div>
  )
}
