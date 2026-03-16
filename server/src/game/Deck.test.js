import Deck from './Deck.js'

test('牌组有 52 张牌', () => {
  const deck = new Deck()
  expect(deck.cards.length).toBe(52)
})

test('洗牌后顺序发生改变', () => {
  const deck = new Deck()
  const before = [...deck.cards]
  deck.shuffle()
  // 极低概率相同，可接受
  expect(deck.cards).not.toEqual(before)
})

test('发牌减少牌组数量', () => {
  const deck = new Deck()
  deck.shuffle()
  deck.deal(5)
  expect(deck.cards.length).toBe(47)
})

test('发出的牌格式正确', () => {
  const deck = new Deck()
  const cards = deck.deal(1)
  expect(cards[0]).toHaveProperty('suit')
  expect(cards[0]).toHaveProperty('rank')
})
