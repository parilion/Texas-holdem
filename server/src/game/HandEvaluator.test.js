import HandEvaluator from './HandEvaluator.js'

const card = (rank, suit) => ({ rank, suit })

test('识别皇家同花顺', () => {
  const cards = [
    card('A','hearts'), card('K','hearts'), card('Q','hearts'),
    card('J','hearts'), card('T','hearts'), card('2','clubs'), card('3','spades')
  ]
  const result = HandEvaluator.evaluate(cards)
  expect(result.rank).toBe(9) // 最高级
  expect(result.name).toBe('皇家同花顺')
})

test('识别同花顺', () => {
  const cards = [
    card('9','hearts'), card('8','hearts'), card('7','hearts'),
    card('6','hearts'), card('5','hearts'), card('2','clubs'), card('A','spades')
  ]
  const result = HandEvaluator.evaluate(cards)
  expect(result.rank).toBe(8)
  expect(result.name).toBe('同花顺')
})

test('识别四条', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('A','clubs'),
    card('A','spades'), card('K','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('四条')
})

test('识别葫芦', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('A','clubs'),
    card('K','spades'), card('K','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('葫芦')
})

test('识别同花', () => {
  const cards = [
    card('A','hearts'), card('K','hearts'), card('J','hearts'),
    card('8','hearts'), card('3','hearts'), card('2','clubs'), card('4','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('同花')
})

test('识别顺子', () => {
  const cards = [
    card('9','hearts'), card('8','diamonds'), card('7','clubs'),
    card('6','spades'), card('5','hearts'), card('2','clubs'), card('A','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('顺子')
})

test('识别三条', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('A','clubs'),
    card('K','spades'), card('Q','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('三条')
})

test('识别两对', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('K','clubs'),
    card('K','spades'), card('Q','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('两对')
})

test('识别一对', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('K','clubs'),
    card('Q','spades'), card('J','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('一对')
})

test('识别高牌', () => {
  const cards = [
    card('A','hearts'), card('K','diamonds'), card('Q','clubs'),
    card('J','spades'), card('9','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('高牌')
})

test('比较两手牌大小', () => {
  const flush = HandEvaluator.evaluate([
    card('A','hearts'), card('K','hearts'), card('J','hearts'),
    card('8','hearts'), card('3','hearts'), card('2','clubs'), card('4','spades')
  ])
  const pair = HandEvaluator.evaluate([
    card('A','hearts'), card('A','diamonds'), card('K','clubs'),
    card('Q','spades'), card('J','hearts'), card('2','clubs'), card('3','spades')
  ])
  expect(HandEvaluator.compare(flush, pair)).toBeGreaterThan(0)
})
