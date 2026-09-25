// -----------------------------------------------------------------------------
// EN/FI copy, in one place.
//
// How it works: pages render ENGLISH server-side (so the HTML a crawler or a
// first-time visitor sees is real content, not an empty shell) and tag each
// translatable node with `data-i18n="key"`. LangToggle ships this same object to
// the browser and swaps text in place when the reader picks Finnish. One source
// of truth for both sides — a key can never drift between server and client.
//
// SCOPE, deliberately: marketing pages, the kit builder and the checkout UI.
// NOT the legal pages (translated legal text carries real risk and must be
// lawyer-reviewed) and NOT product item names — those are frozen English
// snapshots in the database, so translating them on screen would make the site
// and the order record disagree.
//
// The Finnish here is a careful draft, not a native speaker's. It is meant to be
// reviewed and corrected — see FINNISH REVIEW in the README/handoff.
// -----------------------------------------------------------------------------

export type Lang = "en" | "fi";
export const LANGS: Lang[] = ["en", "fi"];
export const DEFAULT_LANG: Lang = "en";

/** localStorage key holding the reader's choice. */
export const LANG_STORAGE_KEY = "moikit-lang";

type Entry = Record<Lang, string>;

export const COPY = {
  // --- header / global chrome ----------------------------------------------
  "nav.kits": { en: "The kits", fi: "Setit" },
  "nav.how": { en: "How it works", fi: "Näin se toimii" },
  "nav.faq": { en: "FAQ", fi: "UKK" },
  "nav.shop": { en: "Shop kits", fi: "Katso setit" },

  "trust.delivery": { en: "One delivery", fi: "Yksi toimitus" },
  "trust.ready": { en: "Ready when you arrive", fi: "Valmiina kun saavut" },
  "trust.local": { en: "Lappeenranta-based", fi: "Lappeenrantalainen" },

  // --- footer ---------------------------------------------------------------
  "footer.blurb": {
    en: "Your home essentials, sorted. Move into an empty apartment and have a functional home the day you arrive.",
    fi: "Kodin perustarvikkeet kerralla kuntoon. Muuta tyhjään asuntoon ja saat toimivan kodin jo saapumispäivänä.",
  },
  "footer.place": { en: "Lappeenranta · Finland · EUR", fi: "Lappeenranta · Suomi · EUR" },
  "footer.kits": { en: "Kits", fi: "Setit" },
  "footer.company": { en: "Company", fi: "Yritys" },
  "footer.contact": { en: "Say moi", fi: "Sano moi" },
  "footer.terms": { en: "Terms of Sale", fi: "Myyntiehdot" },
  "footer.withdrawal": { en: "Right of Withdrawal", fi: "Peruuttamisoikeus" },
  "footer.privacy": { en: "Privacy Notice", fi: "Tietosuojaseloste" },
  "footer.termsShort": { en: "Terms", fi: "Ehdot" },
  "footer.returnsShort": { en: "Returns", fi: "Palautukset" },
  "footer.privacyShort": { en: "Privacy", fi: "Tietosuoja" },

  // --- language toggle ------------------------------------------------------
  // Each label is written in the language it switches TO, so it reads correctly
  // to someone who does not speak the language currently on screen.
  "lang.toFi": { en: "Suomeksi", fi: "Suomeksi" },
  "lang.toEn": { en: "In English", fi: "In English" },
  "lang.aria": { en: "Change language", fi: "Vaihda kieltä" },
} satisfies Record<string, Entry>;

export type CopyKey = keyof typeof COPY;

/** Server-side lookup. Pages render the default language; the client swaps. */
export function t(key: CopyKey, lang: Lang = DEFAULT_LANG): string {
  return COPY[key][lang];
}
