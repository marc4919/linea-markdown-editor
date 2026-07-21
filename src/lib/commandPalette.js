const DIACRITICS_PATTERN = /\p{Diacritic}/gu
const SEARCH_SEPARATOR_PATTERN = /[\s\-_.:/]/
const SEARCH_SEPARATORS_PATTERN = /[\s\-_.:/]+/

export function normalizeCommandSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ')
}

function scoreToken(haystack, token) {
  const exactIndex = haystack.indexOf(token)

  if (exactIndex !== -1) {
    const startsAtBoundary = exactIndex === 0 || SEARCH_SEPARATOR_PATTERN.test(haystack[exactIndex - 1])
    return 1_000 + (startsAtBoundary ? 100 : 0) - exactIndex
  }

  let bestScore = null

  for (const word of haystack.split(SEARCH_SEPARATORS_PATTERN)) {
    const wordScore = scoreFuzzyToken(word, token)
    if (wordScore !== null && (bestScore === null || wordScore > bestScore)) bestScore = wordScore
  }

  return bestScore
}

function scoreFuzzyToken(word, token) {

  let score = 100
  let previousIndex = -1
  let consecutiveCharacters = 0

  for (const character of token) {
    const characterIndex = word.indexOf(character, previousIndex + 1)
    if (characterIndex === -1) return null

    const gap = characterIndex - previousIndex - 1
    if (gap === 0) {
      consecutiveCharacters += 1
      score += 12 + consecutiveCharacters * 2
    } else {
      consecutiveCharacters = 0
      score += 4 - Math.min(gap, 6)
    }

    if (characterIndex === 0) score += 8
    previousIndex = characterIndex
  }

  return score - (word.length - token.length) * 0.05
}

function getSearchableText(command) {
  const keywords = Array.isArray(command.keywords) ? command.keywords.join(' ') : command.keywords
  return normalizeCommandSearch([command.label, command.id, command.shortcut, keywords].filter(Boolean).join(' '))
}

export function filterCommands(commands, query) {
  const normalizedQuery = normalizeCommandSearch(query)
  if (!normalizedQuery) return commands

  const tokens = normalizedQuery.split(' ')

  return commands
    .map((command, index) => {
      const haystack = getSearchableText(command)
      let score = 0

      for (const token of tokens) {
        const tokenScore = scoreToken(haystack, token)
        if (tokenScore === null) return null
        score += tokenScore
      }

      return { command, index, score }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ command }) => command)
}

export function getNextEnabledCommandIndex(commands, currentIndex, direction = 1) {
  if (!commands.length) return -1

  const step = direction < 0 ? -1 : 1
  let index = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < commands.length
    ? currentIndex
    : step > 0 ? -1 : 0

  for (let visited = 0; visited < commands.length; visited += 1) {
    index = (index + step + commands.length) % commands.length
    if (!commands[index].disabled) return index
  }

  return -1
}

export function getFirstEnabledCommandIndex(commands) {
  return getNextEnabledCommandIndex(commands, -1, 1)
}

export function isCommandExecutable(command) {
  return Boolean(command && !command.disabled && typeof command.action === 'function')
}
