import { createHash } from 'node:crypto'
import { SafeProviderError, type GenerateInput, type GeneratedItem, type ItemKind } from '../types.ts'
import { hasControlCharacters } from '../security/strings.ts'

/** Prompt-driven games and their allowed generated item kinds. */
const pairs: Record<string, readonly ItemKind[]> = {
  imposter: ['word', 'category'],
  guessup: ['charade'],
  'truth-or-dare': ['truth', 'dare'],
  'never-have-i-ever': ['statement'],
  'fake-it': ['party-prompt'],
  'fake-story': ['party-prompt'],
  'fact-or-fiction': ['party-prompt'],
  'wrong-answers-only': ['party-prompt'],
  'hot-bomb': ['party-prompt'],
  'hot-bomb-duel': ['party-prompt'],
  'whos-most-likely': ['party-prompt'],
  'would-you-rather': ['party-prompt'],
  'share-or-pass': ['party-prompt'],
  'challenge-20': ['party-prompt'],
  'tilt-it': ['party-prompt'],
  letterburg: ['party-prompt'],
  'discussion-starter': ['party-prompt'],
  'who-am-i': ['party-prompt'],
  'ten-tangle': ['party-prompt'],
  qupid: ['party-prompt'],
  'questions-for-love': ['party-prompt'],
  'a-or-b': ['party-prompt'],
  'reverse-singing': ['party-prompt'],
}
const requestFields = new Set(['schemaVersion', 'requestId', 'game', 'itemKind', 'categoryId', 'categoryName', 'categoryDescription', 'locale', 'suitability', 'adultMode', 'count', 'playerCount', 'playerNames', 'recentItems'])
const textLimits: Record<ItemKind, number> = { word: 90, charade: 100, truth: 260, dare: 260, statement: 240, category: 64, 'party-prompt': 280 }
export const canonicalizeGeneratedText = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const canonical = canonicalizeGeneratedText

function invalid(message: string): never {
  throw new SafeProviderError('INVALID_REQUEST', message, false, 400)
}

export function validateGenerateInput(value: unknown): GenerateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Invalid generation request.')
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(key => !requestFields.has(key))) invalid('The request contains unsupported fields.')
  if (v.schemaVersion !== 1 || typeof v.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(v.requestId)) invalid('Invalid request metadata.')
  if (typeof v.game !== 'string' || !Object.hasOwn(pairs, v.game) || typeof v.itemKind !== 'string' || !pairs[v.game]!.includes(v.itemKind as ItemKind)) invalid('Unsupported game content type.')
  if (typeof v.categoryId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v.categoryId)) invalid('Invalid category.')
  if (v.categoryName !== undefined && (typeof v.categoryName !== 'string' || v.categoryName.length > 120 || hasControlCharacters(v.categoryName))) invalid('Invalid category name.')
  if (v.categoryDescription !== undefined && (typeof v.categoryDescription !== 'string' || v.categoryDescription.length > 280 || hasControlCharacters(v.categoryDescription))) invalid('Invalid category description.')
  if (typeof v.locale !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(v.locale)) invalid('Unsupported locale format.')
  if (!['general', 'teen', 'adult'].includes(String(v.suitability))) invalid('Invalid suitability.')
  if (v.adultMode !== undefined && typeof v.adultMode !== 'boolean') invalid('Invalid adult-mode declaration.')
  if (v.suitability === 'adult' && v.adultMode !== true) invalid('Adult content requires explicit 18+ mode.')
  if (v.adultMode === true && v.suitability !== 'adult') invalid('18+ mode requests must use the adult content pool.')
  if (!Number.isInteger(v.count) || Number(v.count) < 1 || Number(v.count) > 5) invalid('Count must be between 1 and 5.')
  if (v.playerCount !== undefined && (!Number.isInteger(v.playerCount) || Number(v.playerCount) < 2 || Number(v.playerCount) > 32)) invalid('Invalid player count.')
  if (v.playerNames !== undefined && (!Array.isArray(v.playerNames) || v.playerNames.length < 2 || v.playerNames.length > 32 || v.playerNames.some(name => typeof name !== 'string' || name.trim().length < 1 || name.length > 80 || hasControlCharacters(name)))) invalid('Invalid player names.')
  if (!Array.isArray(v.recentItems) || v.recentItems.length > 30 || v.recentItems.some(item => typeof item !== 'string' || item.length > 260 || hasControlCharacters(item))) invalid('Invalid recent-item exclusions.')
  return v as unknown as GenerateInput
}

function tokenSet(text: string): Set<string> {
  return new Set(canonical(text).split(' ').filter(Boolean))
}

export function isNearDuplicateGeneratedText(left: string, right: string): boolean {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) return false
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return intersection / union >= 0.82
}

function containsAnswer(hint: string, answer: string): boolean {
  const answerTokens = canonical(answer).split(' ').filter(Boolean)
  const hintTokens = canonical(hint).split(' ').filter(Boolean)
  if (!answerTokens.length || answerTokens.length > hintTokens.length) return false
  return hintTokens.some((_, start) => answerTokens.every((token, offset) => hintTokens[start + offset] === token))
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length
}

const alwaysDisallowedPatterns = [
  /\b(?:kill yourself|suicide instructions|how to make a bomb|how to build a bomb|make an explosive|rape someone|sexual assault|non[- ]consensual|without (?:their|her|his) consent|blackmail|dox(?:x|xing)|stalk(?:ing)? someone|child sexual abuse|sexualize (?:a|the) minor|underage sex|minor porn|bestiality|incest)\b/i,
  /\b(?:force|pressure|coerce)\b.{0,80}\b(?:kiss|touch|sex|undress|strip|intimate)\b|\b(?:kiss|touch|grab|grope|fondle|strip|undress)\b.{0,60}\b(?:without|against|despite)\b.{0,30}\b(?:consent|permission|wishes)\b/i,
  /\b(?:sex|sexual|naked|nude|undress|kiss|touch|intimate)\b.{0,60}\b(?:underage|minor|child|kid|teenager)\b|\b(?:underage|minor|child|kid|teenager)\b.{0,60}\b(?:sex|sexual|naked|nude|undress|kiss|touch|intimate)\b/i,
  /\b(?:credit card number|social security number|passport number|password is)\b/i,
  /\b(?:graphic sexual description|explicit sex act|describe (?:the )?sex in graphic detail|erotic roleplay|blowjob|fellatio|cunnilingus|penetration|intercourse|anal sex)\b/i,
]
const adultTopicPatterns = [
  /\b(?:sex|sexual|sexually|penis|vagina|vulva|clitoris|orgasm|masturbat(?:e|ion)|bdsm|hentai|porn(?:ography)?|erotic|fetish|sexting|virginity|virgin|condom|lingerie|striptease|hookup|one[- ]night stand|intimate|nudity|nude|naked|topless|undress(?:ing)?|make out|blowjob|fellatio|cunnilingus|intercourse|penetration)\b/i,
  /\bkiss(?:es|ed|ing)?\b.{0,40}\b(?:lips?|mouth)\b|\b(?:lips?|mouth)\b.{0,40}\bkiss\b/i,
  /\b(?:say|shout|announce|declare)\b.{0,70}\b(?:(?:i|you|they|he|she)\s+(?:am|are|is)|i'm|you're|they're)\s+(?:gay|lesbian|bisexual|trans|queer)\b/i,
  /\b(?:take|remove|pull)\s+(?:off\s+)?(?:your|their|his|her)\s+(?:shirt|top|clothes|underwear|bra|pants)\b|\bstrip\s+(?:off|down|naked)\b/i,
  /\b(?:make out|hook up|sleep with)\b/i,
]
function violatesContentGuard(text: string, suitability: GenerateInput['suitability']): boolean {
  if (alwaysDisallowedPatterns.some(pattern => pattern.test(text))) return true
  if (suitability !== 'adult' && adultTopicPatterns.some(pattern => pattern.test(text))) return true
  return false
}

export function validateGeneratedItems(raw: unknown, input: GenerateInput): GeneratedItem[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) throw new SafeProviderError('INVALID_RESPONSE', 'Provider returned an invalid content structure.', true)
  const rows = (raw as { items: unknown[] }).items
  if (rows.length < input.count || rows.length > 10) throw new SafeProviderError('INVALID_RESPONSE', 'Provider returned an incomplete or oversized content batch.', true)
  const recentItems = input.recentItems.map(canonical)
  const seen = new Set<string>()
  const accepted: GeneratedItem[] = []

  for (const candidate of rows) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const row = candidate as Record<string, unknown>
    const allowedFields = input.itemKind === 'category' ? ['text', 'description', 'emoji'] : ['text', 'hints']
    if (Object.keys(row).some(key => !allowedFields.includes(key))) continue
    if (input.itemKind !== 'category' && (!Array.isArray(row.hints) || row.hints.some(hint => typeof hint !== 'string'))) continue
    if (typeof row.text !== 'string') continue
    const text = row.text.trim().replace(/\s+/g, ' ')
    const key = canonical(text)
    if (!text || text.length > textLimits[input.itemKind] || key.length < 2 || hasControlCharacters(text)) continue
    if (seen.has(key) || recentItems.includes(key) || violatesContentGuard(text, input.suitability)) continue
    if ([...seen].some(previous => isNearDuplicateGeneratedText(previous, text)) || input.recentItems.some(previous => isNearDuplicateGeneratedText(previous, text))) continue

    if (input.itemKind === 'category') {
      if (typeof row.description !== 'string') continue
      const description = row.description.trim().replace(/\s+/g, ' ')
      if (description.length < 10 || description.length > 180 || hasControlCharacters(description) || violatesContentGuard(description, input.suitability)) continue
      const emoji = typeof row.emoji === 'string' ? row.emoji.trim() : ''
      if (!emoji || emoji.length > 16 || hasControlCharacters(emoji) || !/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji)) continue
      const slugBase = text.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const nameHash = createHash('sha256').update(canonical(text)).digest('hex').slice(0, 10)
      const categoryId = !slugBase
        ? `category-${nameHash}`
        : slugBase.length > 64
          ? `${slugBase.slice(0, 53).replace(/-+$/g, '')}-${nameHash}`
          : slugBase
      if (accepted.some(item => item.categoryId === categoryId)) continue
      const id = createHash('sha256').update(`${input.game}|category|${categoryId}|${input.suitability}`).digest('hex').slice(0, 24)
      accepted.push({ id, text, categoryId, kind: 'category', locale: input.locale, description, ...(emoji ? { emoji } : {}) })
      seen.add(key)
      if (accepted.length === input.count) break
      continue
    }

    let hints: string[] | undefined
    if (input.game === 'imposter' && input.itemKind === 'word') {
      if (!Array.isArray(row.hints) || row.hints.length !== 20 || row.hints.some(hint => typeof hint !== 'string')) continue
      const normalizedHints = row.hints.map(hint => (hint as string).trim().replace(/\s+/g, ' '))
      const hintKeys = normalizedHints.map(canonical)
      if (normalizedHints.some(hint => !hint || wordCount(hint) > 2 || hint.length > 40 || hasControlCharacters(hint) || violatesContentGuard(hint, input.suitability))) continue
      if (new Set(hintKeys).size !== 20 || normalizedHints.some(hint => containsAnswer(hint, text))) continue
      if (normalizedHints.some((hint, index) => normalizedHints.slice(index + 1).some(other => isNearDuplicateGeneratedText(hint, other)))) continue
      hints = normalizedHints
    } else if (input.itemKind === 'party-prompt') {
      // Party arcade prompts may need structured metadata (e.g. Fake It: category+answer, Fact or Fiction: true/false, Would You Rather/A or B: two options separated by ||). Accept bounded hints as inert metadata validated by content guards.
      if (Array.isArray(row.hints)) {
        hints = [...new Set(row.hints.filter((hint): hint is string => typeof hint === 'string' && hint.trim().length > 0 && wordCount(hint) <= 2 && hint.trim().length <= 180 && !hasControlCharacters(hint) && !violatesContentGuard(hint, input.suitability)).map(hint => hint.trim()))].slice(0, 4)
      }
    } else if (Array.isArray(row.hints)) {
      hints = [...new Set(row.hints.filter((hint): hint is string => typeof hint === 'string' && hint.trim().length > 2 && wordCount(hint) <= 2 && hint.trim().length <= 140 && !hasControlCharacters(hint) && !violatesContentGuard(hint, input.suitability)).map(hint => hint.trim()))].slice(0, 20)
    }

    const id = createHash('sha256').update(`${input.game}|${input.itemKind}|${input.categoryId}|${input.locale}|${input.suitability}|${key}`).digest('hex').slice(0, 24)
    accepted.push({ id, text, categoryId: input.categoryId, kind: input.itemKind, locale: input.locale, ...(hints?.length ? { hints } : {}) })
    seen.add(key)
    if (accepted.length === input.count) break
  }

  if (accepted.length !== input.count) throw new SafeProviderError('INVALID_RESPONSE', 'Provider returned too few distinct, safe, non-repeating items.', true)
  return accepted
}
