const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RED = ['hearts', 'diamonds']

export default function Card({ card, faceDown = false }) {
  if (faceDown || !card) {
    return <div className="card face-down">🂠</div>
  }
  const isRed = RED.includes(card.suit)
  return (
    <div className={`card ${isRed ? 'red' : 'black'}`}>
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  )
}
