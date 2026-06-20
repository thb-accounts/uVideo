const bannedTerms = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'nigger', 'faggot',
]

const leetMap = new Map([
  ['0', 'o'], ['1', 'i'], ['!', 'i'], ['3', 'e'], ['4', 'a'], ['@', 'a'], ['5', 's'], ['$', 's'], ['7', 't'], ['+', 't'],
])

export function normalizeModerationText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((char) => leetMap.get(char) || char)
    .join('')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/[^a-z0-9]+/g, '')
}

export function inspectProfanity(value, extraTerms = []) {
  const normalized = normalizeModerationText(value)
  const match = [...bannedTerms, ...extraTerms].find((term) => normalized.includes(normalizeModerationText(term)))
  return { clean: !match, match: match || null, normalized }
}
