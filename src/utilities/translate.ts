// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import translationSource from './strings.json'

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

const stringMaps: Record<string, any> =  translationSource;
// Translations are keyed by language. Language codes are assumed to be
// baseLang-regionCode or just baseLang. If the baseLang entry is not there we
// add it as a reference to the region. We assume the first region listed is
// the base region.
Object.keys(stringMaps).forEach(key => {
  const baseLang = getBaseLanguage(key);
  if (!stringMaps[key.toLowerCase()]) {
    stringMaps[key.toLowerCase()] = stringMaps[key];
  }
  if (baseLang && !stringMaps[baseLang]) {
    stringMaps[baseLang] = stringMaps[key];
  }
});

function getURLParam(key:string) {
  // @ts-ignore
  return (new URL(document.location)).searchParams.get(key);
}

var lang = getURLParam("lang") || getPageLanguage() || getFirstBrowserLanguage() || defaultLang;
lang = lang.toLowerCase();
const baseLang = getBaseLanguage(lang);

const currentStringMaps:any[] = [];
if (stringMaps[lang]) {
  currentStringMaps.push(stringMaps[lang]);
}
if (lang !== baseLang) {
  currentStringMaps.push(stringMaps[baseLang]);
}
if (baseLang !== defaultLang) {
  currentStringMaps.push(stringMaps[defaultLang])
}

function resolve(stringID:string) {
  const stringMap = currentStringMaps.find(t => t[stringID]);
  if (stringMap) {
    return stringMap[stringID];
  } else {
    return stringID;
  }
} 
/**
 * Translates a string by referencing a hash of translated strings.
 * If the lookup fails, the string ID is used.
 * Arguments after the String ID are substituted for substitution tokens in
 * the looked up string.
 * Substitution tokens can have the form "%@" or "%@" followed by a single digit.
 * Substitution parameters with no digit are substituted sequentially.
 * So, tr('%@, %@, %@', 'one', 'two', 'three') returns 'one, two, three'.
 * Substitution parameters followed by a digit are substituted positionally.
 * So, tr('%@1, %@1, %@2', 'baa', 'black sheep') returns 'baa, baa, black sheep'.
 * If there are not substitution parameters, or not one for the expected position,
 * then the string is not modified.
 *
 * @param sID {{string}} a string id
 * @param args an array of strings or variable sequence of strings
 * @returns {string}
 */
function translate(sID:string, ...args:string[]) {
  function replacer(match:string) {
    if (match.length===2) {
      return (args && args[ix++]) || match;
    } else {
      return (args && args[Number(match[2])-1]) || match;
    }
  }

  // if (typeof args === 'string') {
  //   args = Array.from(arguments).slice(1);
  // }


  let s = resolve(sID);
  let ix = 0;
  return s.replace(/%@[0-9]?/g, replacer);
}

export default translate
