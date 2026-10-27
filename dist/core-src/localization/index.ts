import type { KidLocalization } from './types'

import ar from './locales/ar.json'
import de from './locales/de.json'
import enGBStrings from './locales/en-GB.json'
import esMXStrings from './locales/es-MX.json'
import es from './locales/es.json'
import frCAStrings from './locales/fr-CA.json'
import fr from './locales/fr.json'
import hi from './locales/hi.json'
import idStrings from './locales/id.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import ms from './locales/ms.json'
import nl from './locales/nl.json'
import ptBRStrings from './locales/pt-BR.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import th from './locales/th.json'
import tr from './locales/tr.json'
import zhHant from './locales/zh-Hant.json'
import zh from './locales/zh.json'
import arPermissions from './permissions/ar.json'
import dePermissions from './permissions/de.json'
import enGbPermissions from './permissions/en-GB.json'
import esMxPermissions from './permissions/es-MX.json'
import esPermissions from './permissions/es.json'
import frCaPermissions from './permissions/fr-CA.json'
import frPermissions from './permissions/fr.json'
import hiPermissions from './permissions/hi.json'
import idPermissions from './permissions/id.json'
import itPermissions from './permissions/it.json'
import jaPermissions from './permissions/ja.json'
import koPermissions from './permissions/ko.json'
import msPermissions from './permissions/ms.json'
import nlPermissions from './permissions/nl.json'
import ptBrPermissions from './permissions/pt-BR.json'
import ptPermissions from './permissions/pt.json'
import ruPermissions from './permissions/ru.json'
import thPermissions from './permissions/th.json'
import trPermissions from './permissions/tr.json'
import zhHantPermissions from './permissions/zh-Hant.json'
import zhPermissions from './permissions/zh.json'

export { en } from './en'
export type { KidLocalization, KidPermissionStrings, KidStrings } from './types'

function withLocale(
  strings: Omit<KidLocalization, 'locale' | 'permissions'>,
  permissions: KidLocalization['permissions'],
  locale: string,
): KidLocalization {
  return { ...strings, permissions, locale }
}

export const arSA = /* @__PURE__ */ withLocale(ar, arPermissions, 'ar')
export const deDE = /* @__PURE__ */ withLocale(de, dePermissions, 'de')
export const enGB = /* @__PURE__ */ withLocale(enGBStrings, enGbPermissions, 'en-GB')
export const esES = /* @__PURE__ */ withLocale(es, esPermissions, 'es')
export const esMX = /* @__PURE__ */ withLocale(esMXStrings, esMxPermissions, 'es-MX')
export const frFR = /* @__PURE__ */ withLocale(fr, frPermissions, 'fr')
export const frCA = /* @__PURE__ */ withLocale(frCAStrings, frCaPermissions, 'fr-CA')
export const hiIN = /* @__PURE__ */ withLocale(hi, hiPermissions, 'hi')
export const idID = /* @__PURE__ */ withLocale(idStrings, idPermissions, 'id')
export const itIT = /* @__PURE__ */ withLocale(it, itPermissions, 'it')
export const jaJP = /* @__PURE__ */ withLocale(ja, jaPermissions, 'ja')
export const koKR = /* @__PURE__ */ withLocale(ko, koPermissions, 'ko')
export const msMY = /* @__PURE__ */ withLocale(ms, msPermissions, 'ms')
export const nlNL = /* @__PURE__ */ withLocale(nl, nlPermissions, 'nl')
export const ptPT = /* @__PURE__ */ withLocale(pt, ptPermissions, 'pt')
export const ptBR = /* @__PURE__ */ withLocale(ptBRStrings, ptBrPermissions, 'pt-BR')
export const ruRU = /* @__PURE__ */ withLocale(ru, ruPermissions, 'ru')
export const thTH = /* @__PURE__ */ withLocale(th, thPermissions, 'th')
export const trTR = /* @__PURE__ */ withLocale(tr, trPermissions, 'tr')
export const zhCN = /* @__PURE__ */ withLocale(zh, zhPermissions, 'zh')
export const zhTW = /* @__PURE__ */ withLocale(zhHant, zhHantPermissions, 'zh-Hant')

const ENGLISH: KidLocalization = { locale: 'en' }

export const KID_LOCALES = [
  'ar',
  'de',
  'en',
  'en-GB',
  'es',
  'es-MX',
  'fr',
  'fr-CA',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl',
  'pt',
  'pt-BR',
  'ru',
  'th',
  'tr',
  'zh',
  'zh-Hant',
] as const

export type KidLocale = (typeof KID_LOCALES)[number]

const TRADITIONAL_CHINESE_SUBTAGS = ['hant', 'tw', 'hk', 'mo']

function resolveLocale(tag: string): KidLocale {
  const lower = tag.replace(/_/g, '-').toLowerCase()
  const match = (t: string) => KID_LOCALES.find((l) => l.toLowerCase() === t)
  const exact = match(lower)
  if (exact) return exact
  const [language = '', ...subtags] = lower.split('-')
  if (language === 'zh' && subtags.some((s) => TRADITIONAL_CHINESE_SUBTAGS.includes(s))) return 'zh-Hant'
  return match(language) ?? 'en'
}

/** Matches the exact tag first, then Traditional Chinese for `zh-TW`, `zh-HK`, `zh-MO` and `zh-Hant`, then the base
 * language, then English. English is `{ locale: 'en' }`, which keeps the built-in copy. */
export function getKidLocalization(locale: string): KidLocalization {
  const byTag: Record<KidLocale, KidLocalization> = {
    ar: arSA,
    de: deDE,
    en: ENGLISH,
    'en-GB': enGB,
    es: esES,
    'es-MX': esMX,
    fr: frFR,
    'fr-CA': frCA,
    hi: hiIN,
    id: idID,
    it: itIT,
    ja: jaJP,
    ko: koKR,
    ms: msMY,
    nl: nlNL,
    pt: ptPT,
    'pt-BR': ptBR,
    ru: ruRU,
    th: thTH,
    tr: trTR,
    zh: zhCN,
    'zh-Hant': zhTW,
  }
  return byTag[resolveLocale(locale)]
}
