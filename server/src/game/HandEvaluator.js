const RANK_ORDER = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
const RANK_VALUE = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i + 2]))

const HAND_NAMES = ['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺','皇家同花顺']

function getCombinations(arr, k) {
  if (k === 0) return [[]]
  if (arr.length === 0) return []
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = getCombinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function evaluateFive(cards) {
  const ranks = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])
  const isStraight = ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5
  // 低顺 A-2-3-4-5
  const isLowStraight = JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])

  const counts = {}
  ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1 })
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const groupCounts = groups.map(g => g[1])

  let rank, tiebreakers

  if (isFlush && (isStraight || isLowStraight)) {
    rank = ranks[0] === 14 && isStraight ? 9 : 8
    tiebreakers = isLowStraight ? [5, 4, 3, 2, 1] : ranks
  } else if (groupCounts[0] === 4) {
    rank = 7
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (groupCounts[0] === 3 && groupCounts[1] === 2) {
    rank = 6
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (isFlush) {
    rank = 5
    tiebreakers = ranks
  } else if (isStraight || isLowStraight) {
    rank = 4
    tiebreakers = isLowStraight ? [5, 4, 3, 2, 1] : ranks
  } else if (groupCounts[0] === 3) {
    rank = 3
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (groupCounts[0] === 2 && groupCounts[1] === 2) {
    rank = 2
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (groupCounts[0] === 2) {
    rank = 1
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else {
    rank = 0
    tiebreakers = ranks
  }

  return { rank, name: HAND_NAMES[rank], tiebreakers }
}

export default class HandEvaluator {
  static evaluate(sevenCards) {
    const combos = getCombinations(sevenCards, 5)
    let best = null
    for (const combo of combos) {
      const result = evaluateFive(combo)
      if (!best || HandEvaluator.compare(result, best) > 0) {
        best = result
      }
    }
    return best
  }

  static compare(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank
    for (let i = 0; i < a.tiebreakers.length; i++) {
      if (a.tiebreakers[i] !== b.tiebreakers[i]) return a.tiebreakers[i] - b.tiebreakers[i]
    }
    return 0
  }
}
