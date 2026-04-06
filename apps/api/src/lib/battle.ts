// apps/api/src/lib/battle.ts — P2P Battle resolution logic

export type Move = 'rock' | 'paper' | 'scissors'

export interface RoundResult {
  round: number
  challengerMove: Move
  defenderMove: Move
  winnerId: string | null // null = draw
}

export interface BattleResult {
  winnerId: string | null
  rounds: RoundResult[]
  challengerWins: number
  defenderWins: number
}

const BEATS: Record<Move, Move> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}

function resolveRound(challengerMove: Move, defenderMove: Move, challengerId: string, defenderId: string): string | null {
  if (challengerMove === defenderMove) return null
  return BEATS[challengerMove] === defenderMove ? challengerId : defenderId
}

/**
 * Resolve a battle: first to 2 wins.
 * Draws don't count — match continues until someone reaches 2 round wins.
 */
export function resolveBattle(
  challengerMoves: Move[],
  defenderMoves: Move[],
  challengerId: string,
  defenderId: string,
): BattleResult {
  const rounds: RoundResult[] = []
  let challengerWins = 0
  let defenderWins = 0

  const maxRounds = Math.min(challengerMoves.length, defenderMoves.length)

  for (let i = 0; i < maxRounds; i++) {
    const winnerId = resolveRound(challengerMoves[i], defenderMoves[i], challengerId, defenderId)
    rounds.push({
      round: i + 1,
      challengerMove: challengerMoves[i],
      defenderMove: defenderMoves[i],
      winnerId,
    })

    if (winnerId === challengerId) challengerWins++
    else if (winnerId === defenderId) defenderWins++

    // First to 2 wins
    if (challengerWins >= 2 || defenderWins >= 2) break
  }

  let finalWinner: string | null = null
  if (challengerWins > defenderWins) finalWinner = challengerId
  else if (defenderWins > challengerWins) finalWinner = defenderId

  return { winnerId: finalWinner, rounds, challengerWins, defenderWins }
}

/**
 * Spin the loot wheel — weighted random point amount.
 * Amounts: 25, 50, 75, 100, 125, 150
 * Weights skew toward lower values.
 */
export function spinLootWheel(): number {
  const amounts = [25, 50, 75, 100, 125, 150]
  const weights = [30, 25, 20, 13, 8, 4] // total = 100
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let random = Math.random() * totalWeight
  for (let i = 0; i < amounts.length; i++) {
    random -= weights[i]
    if (random <= 0) return amounts[i]
  }
  return amounts[0]
}
