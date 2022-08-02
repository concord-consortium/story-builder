// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import translationSource from './strings.json'

type Translation = Record<string, string>
interface LanguageFileEntry {
  key: string;
  contents: Translation;
}

const defaultLang = 'en';

// returns baseLANG from baseLANG-REGION if REGION exists
const getBaseLanguage = function(langKey: string) {
  return langKey.split("-")[0]
}

// use language of page, which is used by CODAP, with separate build for each language
const getPageLanguage = function() {
  const pageLang = document.documentElement.lang
  return pageLang && (pageLang !== "unknown")
          ? pageLang
          : undefined
}

const getFirstBrowserLanguage = function() {
  const nav = window.navigator
  const languages = nav ? (nav.languages || [])
      .concat([
        nav.language,
        (nav as any).browserLanguage,
        (nav as any).systemLanguage,
        (nav as any).userLanguage
      ]) : []
  for (let language of languages) {
    if (language) { return language }
  }
  return undefined
}

const translations: Record<string, Translation> =  translationSource;
// Translations are keyed by language. Language codes are assumed to be
// baseLang-regionCode or just baseLang. If the baseLang entry is not there we
// add it as a reference to the region. We assume the first region listed is
// the base region.
Object.keys(translations).forEach(key => {
  const baseLang = getBaseLanguage(key);
  if (baseLang && !translations[baseLang]) {
    translations[baseLang] = translations[key];
  }
});

function getURLParam(key:string) {
  // @ts-ignore
  return (new URL(document.location)).searchParams.get(key);
}

const lang = getURLParam("lang") || getPageLanguage() || getFirstBrowserLanguage()
const baseLang = getBaseLanguage(lang || '')
// CODAP/Sproutcore lower cases language in documentElement
const currentLang = lang && translations[lang.toLowerCase()] ? lang : baseLang && translations[baseLang] ? baseLang : defaultLang;

const translationList = [translations[currentLang]];
if (currentLang !== baseLang) {
  translationList.push(translations[baseLang]);
}
if (baseLang !== defaultLang) {
  translationList.push(translations[defaultLang])
}

// console.log(`CFM: using ${defaultLang} for translation (lang is "${(urlParams as any).lang}" || "${getFirstBrowserLanguage()}")`)

const varRegExp = /%\{\s*([^}\s]*)\s*}/g // '%{key}' where key is any non-right-bracket string

const translate = function(key: string, vars?: Record<string ,string>, lang?: string) {
  vars = vars || {};
  lang = lang || currentLang;
  // @ts-ignore
  lang = lang.toLowerCase();
  let translation = translations[lang] ? translations[lang][key] : key;
  if (translation == null) { translation = key }
  return translation.replace(varRegExp, function(match: string, key: string) {
    return vars && vars[key] || `'** UKNOWN KEY: ${key} **`
  })
}

export default translate
