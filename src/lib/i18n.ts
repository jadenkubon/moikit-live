// -----------------------------------------------------------------------------
// EN/FI copy, in one place.
//
// How it works: pages render ENGLISH server-side (so the HTML a crawler or a
// first-time visitor sees is real content, not an empty shell) and tag each
// translatable node with `data-i18n="key"`. LangToggle ships this same object to
// the browser and swaps text in place when the reader picks Finnish. One source
// of truth for both sides — a key can never drift between server and client.
//
// HARD BOUNDARY — this is a presentation layer and nothing more.
//
// Translation MUST NOT touch anything the ordering or payment path reads. In
// practice that means: never edit `src/data/kits.ts`, and never key off it.
// That file is the catalogue and pricing source of truth, imported by
// `api/checkout.ts` and `api/stripe-webhook.ts`; a translation bug there would
// stop being a cosmetic problem and start being a money problem.
//
// The visible consequence, accepted deliberately: copy that lives in kits.ts —
// the FAQ answers, kit taglines and blurbs — stays ENGLISH even in Finnish
// mode. That is a considered trade, not an oversight. Readers who need it will
// use a browser translator; we are not risking the checkout for it.
//
// Also out of scope: the legal pages (translated legal text carries real risk
// and needs a lawyer) and product item names, which are frozen English
// snapshots on the order record — translating them on screen would make the
// site and the database disagree about what was bought.
//
// So: only page/component templates get data-i18n. If a string's source is a
// file the order path imports, leave it alone.
//
// FINNISH REVIEW: the Finnish below is a careful draft, not a native speaker's.
// It is meant to be read top-to-bottom and corrected as one list — that is the
// whole reason every string lives in this file instead of in the templates.
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

  // --- home: hero -----------------------------------------------------------
  "home.badge.fee": { en: "✦ One flat delivery fee", fi: "✦ Yksi kiinteä toimitusmaksu" },
  "home.badge.pricing": { en: "✦ Transparent pricing", fi: "✦ Läpinäkyvä hinnoittelu" },
  "home.badge.ready": { en: "✦ Ready when you land", fi: "✦ Valmiina kun saavut" },
  // Carries a <br>, so this one is swapped as HTML, not text.
  "home.hero.title": { en: "Your new home,<br />ready instantly.", fi: "Uusi kotisi,<br />heti valmiina." },
  "home.hero.body": {
    en: "Finnish rentals come bare — no bed, no dishes, no towels. Order one MoiKit and walk into a furnished, functional home the day you arrive. One order, sorted.",
    fi: "Suomalaiset vuokra-asunnot ovat tyhjiä — ei sänkyä, ei astioita, ei pyyhkeitä. Tilaa yksi MoiKit ja astu valmiiseen, toimivaan kotiin jo saapumispäivänä. Yksi tilaus, kaikki kunnossa.",
  },
  "home.cta.seeKits": { en: "See the kits", fi: "Katso setit" },
  "home.chip.sleep": { en: "✓ Sleep sorted", fi: "✓ Nukkuminen kunnossa" },
  "home.chip.kitchen": { en: "✓ Kitchen stocked", fi: "✓ Keittiö valmiina" },
  "home.chip.day1": { en: "→ Ready day one", fi: "→ Valmis heti ensimmäisenä päivänä" },

  // --- home: the kits -------------------------------------------------------
  "home.kits.title": { en: "Good, better, best — no guessing.", fi: "Hyvä, parempi, paras — ei arvailua." },
  "home.kits.body": {
    en: "Every kit covers all three rooms — bedroom, kitchen and bathroom. Comfort and place settings step up as you go, and you can drop any room or item you don't need.",
    fi: "Jokainen setti kattaa kaikki kolme huonetta — makuuhuoneen, keittiön ja kylpyhuoneen. Mukavuus ja astiasto paranevat tasoa nostaessa, ja voit poistaa minkä tahansa huoneen tai tuotteen jota et tarvitse.",
  },
  "home.compare.open": { en: "Compare the tiers", fi: "Vertaile tasoja" },
  "home.compare.close": { en: "Hide the tier comparison", fi: "Piilota tasovertailu" },
  "home.compare.hint": {
    en: "Hover or tap a tier to see what's inside",
    fi: "Vie osoitin tason päälle tai napauta nähdäksesi sisällön",
  },

  // --- home: how it works ---------------------------------------------------
  "home.how.title": { en: "Three steps between you and a sorted home.", fi: "Kolme askelta valmiiseen kotiin." },
  "home.step1.num": { en: "STEP 01", fi: "VAIHE 01" },
  "home.step1.title": { en: "Pick your kit", fi: "Valitse settisi" },
  "home.step1.body": {
    en: "Basic, Premium or Platinum — or a custom mix. Every item and price is listed, so you know exactly what you're getting.",
    fi: "Basic, Premium tai Platinum — tai oma yhdistelmä. Jokainen tuote ja hinta on listattu, joten tiedät tarkalleen mitä saat.",
  },
  "home.step2.num": { en: "STEP 02", fi: "VAIHE 02" },
  "home.step2.title": { en: "Tell us where and when", fi: "Kerro minne ja milloin" },
  "home.step2.body": {
    en: "Your Lappeenranta address and move-in date. One delivery fee, no parcels to chase.",
    fi: "Lappeenrannan osoitteesi ja muuttopäiväsi. Yksi toimitusmaksu, ei paketteja jahdattavana.",
  },
  "home.step3.num": { en: "STEP 03", fi: "VAIHE 03" },
  "home.step3.title": { en: "Move in, it's waiting", fi: "Muuta sisään, se odottaa" },
  "home.step3.body": {
    en: "We deliver it all in one drop, ready and waiting — so your first evening is about settling in, not an errand.",
    fi: "Toimitamme kaiken kerralla, valmiina odottamaan — jotta ensimmäinen iltasi olisi asettumista, ei asiointia.",
  },

  // --- home: why moikit -----------------------------------------------------
  "home.why.eyebrow": { en: "Why MoiKit", fi: "Miksi MoiKit" },
  "home.why.title": { en: "Built to take the whole errand off your plate.", fi: "Tehty hoitamaan koko homma puolestasi." },
  "home.value1.title": { en: "Skip the checklist", fi: "Unohda ostoslista" },
  "home.value1.body": {
    en: "We researched exactly what an empty apartment needs. You don't have to walk three stores with a 40-item list.",
    fi: "Selvitimme tarkalleen mitä tyhjä asunto tarvitsee. Sinun ei tarvitse kiertää kolmea kauppaa 40 tuotteen listan kanssa.",
  },
  "home.value2.title": { en: "Made for Finnish rentals", fi: "Tehty suomalaisiin vuokra-asuntoihin" },
  "home.value2.body": {
    en: "Right sizes, right basics — mattress, duvet and cookware chosen to fit a bare Nordic apartment. Nothing turns up wrong or missing.",
    fi: "Oikeat koot, oikeat perusasiat — patja, peitto ja keittiövälineet valittu tyhjään pohjoismaiseen asuntoon. Mikään ei tule vääränä tai puutu.",
  },
  "home.value3.title": { en: "One order, ready", fi: "Yksi tilaus, valmista" },
  "home.value3.body": {
    en: "One delivery, no hauling, no returns. Set up and waiting so your first night already feels like home.",
    fi: "Yksi toimitus, ei raahaamista, ei palautuksia. Valmiina odottamassa, jotta ensimmäinen yösi tuntuu jo kodilta.",
  },

  // --- home: what's inside --------------------------------------------------
  "home.inside.eyebrow": { en: "What's inside, transparently", fi: "Mitä sisältää, läpinäkyvästi" },
  "home.inside.title": { en: "See exactly what's in every kit.", fi: "Näe tarkalleen mitä jokainen setti sisältää." },
  "home.inside.body": {
    en: "Every kit is fully itemized — we list each item and its price, so you always know exactly what you're getting and what you're paying for, plus a delivery fee. And every kit is modular: drop anything you don't need and the price drops with it. Here's the Basic Kit, item by item.",
    fi: "Jokainen setti on täysin eritelty — listaamme jokaisen tuotteen ja sen hinnan, joten tiedät aina tarkalleen mitä saat ja mistä maksat, plus toimitusmaksun. Ja jokainen setti on muokattava: poista mitä et tarvitse, ja hinta laskee mukana. Tässä Basic-setti tuote tuotteelta.",
  },
  "home.inside.cta": { en: "Customize the kits", fi: "Muokkaa settejä" },
  "home.inside.note": { en: "Basic Kit · every item listed", fi: "Basic-setti · kaikki tuotteet listattu" },
  "home.inside.itemsTotal": { en: "Items total", fi: "Tuotteet yhteensä" },
  "home.inside.footnote": { en: "+ delivery fee · fully itemized", fi: "+ toimitusmaksu · kaikki eritelty" },
  "common.items": { en: "items", fi: "tuotetta" },

  // --- home: built for Lappeenranta ----------------------------------------
  "home.local.eyebrow": { en: "Built for Lappeenranta arrivals", fi: "Tehty Lappeenrantaan saapuville" },
  "home.local.title": {
    en: "New in town, new apartment, 40-item shopping list?",
    fi: "Uusi kaupunki, uusi asunto, 40 tuotteen ostoslista?",
  },
  "home.local.body": {
    en: "We're students and newcomers too. MoiKit exists for the people landing here with a suitcase — so your first days are about settling in, not running a checklist across three stores in a city you don't know yet.",
    fi: "Olemme itsekin opiskelijoita ja tulokkaita. MoiKit on olemassa niille, jotka saapuvat tänne matkalaukun kanssa — jotta ensimmäiset päiväsi olisivat asettumista, eivät ostoslistan juoksuttamista kolmessa kaupassa vieraassa kaupungissa.",
  },
  "home.aud1": { en: "LUT University students", fi: "LUT-yliopiston opiskelijat" },
  "home.aud2": { en: "Exchange & international arrivals", fi: "Vaihto- ja kansainväliset tulijat" },
  "home.aud3": { en: "New renters", fi: "Uudet vuokralaiset" },
  "home.aud4": { en: "Anyone landing with a suitcase", fi: "Kuka tahansa matkalaukun kanssa saapuva" },

  // --- home: faq + closing --------------------------------------------------
  "home.faq.eyebrow": { en: "Good to know", fi: "Hyvä tietää" },
  "home.faq.title": { en: "Questions, answered.", fi: "Kysymykset, vastattu." },
  "home.faq.stillTitle": { en: "Still have a question?", fi: "Vieläkö kysyttävää?" },
  "home.faq.stillBody": {
    en: "We answer DMs fast and love helping newcomers settle in.",
    fi: "Vastaamme viesteihin nopeasti ja autamme mielellämme uusia tulijoita asettumaan.",
  },
  "home.faq.dm": { en: "DM @moi.kit_fi", fi: "Viesti @moi.kit_fi" },
  "home.final.title": { en: "Moving soon? Let's get your place sorted.", fi: "Muutatko pian? Laitetaan kotisi kuntoon." },
  "home.final.body": {
    en: "Tell us the address and the date. We'll have your home waiting when you walk in.",
    fi: "Kerro osoite ja päivämäärä. Kotisi odottaa valmiina kun astut sisään.",
  },
  "home.final.cta": { en: "Browse the kits", fi: "Selaa settejä" },


  // --- kit page / builder ---------------------------------------------------
  "builder.cancelled.strong": { en: "Checkout cancelled.", fi: "Maksu peruutettu." },
  "builder.cancelled.body": {
    en: "Nothing was charged and your kit is exactly as you left it \u2014 pick up where you stopped whenever you're ready.",
    fi: "Mit\u00e4\u00e4n ei veloitettu ja settisi on t\u00e4sm\u00e4lleen kuten j\u00e4tit sen \u2014 jatka siit\u00e4 mihin j\u00e4it kun sinulle sopii.",
  },
  "builder.cancelled.back": { en: "Back to the builder", fi: "Takaisin muokkaimeen" },
  "builder.allKits": { en: "\u2190 All kits", fi: "\u2190 Kaikki setit" },
  "builder.badge.rooms": { en: "\u2726 Bedroom + kitchen + bathroom", fi: "\u2726 Makuuhuone + keitti\u00f6 + kylpyhuone" },
  "builder.badge.itemized": { en: "items, itemized", fi: "tuotetta, eritelty" },
  "builder.badge.delivery": { en: "delivery", fi: "toimitus" },
  "builder.customize": { en: "Customize this kit", fi: "Muokkaa t\u00e4t\u00e4 setti\u00e4" },
  "builder.eyebrow": { en: "Build your kit", fi: "Rakenna settisi" },
  "builder.title": { en: "Keep what you need. Drop what you don't.", fi: "Pid\u00e4 mit\u00e4 tarvitset. Poista mit\u00e4 et." },
  "builder.intro": {
    en: "Every item is listed with its price. Use \u2212 and + on single items, or drop a whole room if you only need part of the kit \u2014 just the bedroom, just the kitchen, whatever fits. Your total updates instantly, plus delivery.",
    fi: "Jokainen tuote on listattu hintoineen. K\u00e4yt\u00e4 \u2212 ja + yksitt\u00e4isiin tuotteisiin, tai poista kokonainen huone jos tarvitset vain osan setist\u00e4 \u2014 pelk\u00e4n makuuhuoneen, pelk\u00e4n keitti\u00f6n, mik\u00e4 sopii. Loppusumma p\u00e4ivittyy heti, plus toimitus.",
  },
  "builder.dropRoom": { en: "Drop room", fi: "Poista huone" },
  "builder.restoreRoom": { en: "Restore room", fi: "Palauta huone" },
  "builder.aria.dec": { en: "Remove one", fi: "Poista yksi" },
  "builder.aria.inc": { en: "Add one", fi: "Lis\u00e4\u00e4 yksi" },
  "builder.yourKit": { en: "Your kit", fi: "Settisi" },
  "builder.kitTotal": { en: "Kit total", fi: "Setin summa" },
  // {a} included, {b} total, {c} individual pieces.
  "builder.summary": { en: "{a} of {b} items \u00b7 {c} pieces", fi: "{a}/{b} tuotetta \u00b7 {c} kappaletta" },
  "builder.terms": {
    en: "I have read and accept the <a href=\"/legal/terms/\" class=\"text-amber underline underline-offset-2\">Terms of Sale</a> and the <a href=\"/legal/privacy/\" class=\"text-amber underline underline-offset-2\">Privacy Notice</a>, including how my delivery details are stored and used to fulfil this order.",
    fi: "Olen lukenut ja hyv\u00e4ksyn <a href=\"/legal/terms/\" class=\"text-amber underline underline-offset-2\">myyntiehdot</a> ja <a href=\"/legal/privacy/\" class=\"text-amber underline underline-offset-2\">tietosuojaselosteen</a>, mukaan lukien miten toimitustietojani s\u00e4ilytet\u00e4\u00e4n ja k\u00e4ytet\u00e4\u00e4n t\u00e4m\u00e4n tilauksen toimittamiseen.",
  },
  "builder.acceptError": { en: "Please tick the box above before paying.", fi: "Rastita yll\u00e4 oleva ruutu ennen maksamista." },
  "builder.pay": { en: "Pay with Stripe", fi: "Maksa Stripell\u00e4" },
  "builder.redirecting": { en: "Redirecting\u2026", fi: "Ohjataan\u2026" },
  "builder.depositPre": { en: "Pay a", fi: "Maksa nyt verkossa" },
  "builder.depositPost": {
    en: "deposit online now (50%), the rest in cash on delivery.",
    fi: "k\u00e4siraha (50 %), loput k\u00e4teisell\u00e4 toimituksen yhteydess\u00e4.",
  },
  "builder.reset": { en: "Reset to the full kit", fi: "Palauta koko setti" },
  "builder.compare.eyebrow": { en: "Compare & trade up", fi: "Vertaile ja p\u00e4ivit\u00e4" },
  "builder.compare.title": { en: "See how the tiers stack up.", fi: "Katso miten tasot vertautuvat." },
  "builder.closing": {
    en: "Tell us your address and move-in date. We'll confirm your exact items and have it waiting.",
    fi: "Kerro osoitteesi ja muuttop\u00e4iv\u00e4si. Vahvistamme tarkat tuotteesi ja ne odottavat valmiina.",
  },

  // --- checkout success page ------------------------------------------------
  // Labels only. Everything on that page that came back from Stripe — the
  // customer name, city, email, kit name, item names, every amount and the
  // reference — is order data and is NOT tagged. "success.yourOrder" is the
  // fallback heading, applied only when Stripe gave us no kit name, so it can
  // never overwrite a real one.
  "success.eyebrow.paid": { en: "PAYMENT RECEIVED", fi: "MAKSU VASTAANOTETTU" },
  "success.eyebrow.thanks": { en: "THANK YOU", fi: "KIITOS" },
  "success.title.paid": { en: "Your kit is booked.", fi: "Settisi on varattu." },
  "success.title.thanks": { en: "Your order is in.", fi: "Tilauksesi on vastaanotettu." },
  "success.lede.paid": {
    en: "Thanks — your deposit is paid. We'll email you to confirm the delivery date for your address in Lappeenranta.",
    fi: "Kiitos — käsiraha on maksettu. Lähetämme sähköpostia ja vahvistamme toimituspäivän Lappeenrannan osoitteeseesi.",
  },
  "success.lede.thanks": {
    en: "Thanks — we've got your order. We'll email you to confirm the delivery date. If anything looks wrong, just reply to that email.",
    fi: "Kiitos — tilauksesi on vastaanotettu. Lähetämme sähköpostia ja vahvistamme toimituspäivän. Jos jokin näyttää väärältä, vastaa vain siihen viestiin.",
  },
  "success.yourOrder": { en: "Your order", fi: "Tilauksesi" },
  "success.ref": { en: "REF", fi: "VIITE" },
  "success.items": { en: "Items", fi: "Tuotteet" },
  "success.delivery": { en: "Delivery", fi: "Toimitus" },
  "success.total": { en: "Total", fi: "Yhteensä" },
  "success.depositPaid": { en: "Deposit paid today", fi: "Tänään maksettu käsiraha" },
  "success.balance": { en: "Balance — cash on delivery", fi: "Loppusumma — käteisellä toimituksessa" },
  "success.paidInFull": { en: "Paid in full — nothing due on delivery", fi: "Maksettu kokonaan — ei maksettavaa toimituksessa" },
  "success.requested": { en: "Requested delivery:", fi: "Toivottu toimitus:" },
  "success.sentTo": { en: "Confirmation sent to", fi: "Vahvistus lähetetty osoitteeseen" },
  "success.next": { en: "What happens next", fi: "Näin etenemme" },
  "success.step1": { en: "We email you to confirm your address and move-in date.", fi: "Lähetämme sähköpostia ja vahvistamme osoitteesi ja muuttopäiväsi." },
  "success.step2": { en: "We deliver everything in one drop.", fi: "Toimitamme kaiken yhdellä kerralla." },
  "success.step3": { en: "You pay the remaining balance in cash when it arrives.", fi: "Maksat loppusumman käteisellä toimituksen yhteydessä." },
  "success.backHome": { en: "Back to MoiKit", fi: "Takaisin MoiKitiin" },
  "success.question": { en: "Question about my order", fi: "Kysymys tilauksestani" },

  // --- pre-launch coming-soon modal ------------------------------------------
  // "MoiKit — Lappeenranta" is a brand and a place name, so it is not tagged.
  "soon.title": { en: "Coming soon", fi: "Tulossa pian" },
  "soon.body": {
    en: "We're putting the finishing touches on our kits. Leave your details and we'll let you know the moment MoiKit opens for orders.",
    fi: "Viimeistelemme settejämme. Jätä tietosi, niin ilmoitamme heti kun MoiKit avautuu tilauksille.",
  },
  "soon.cta": { en: "Shop now", fi: "Osta nyt" },
  "soon.footA": { en: "One delivery", fi: "Yksi toimitus" },
  "soon.footB": { en: "Ready when you arrive", fi: "Valmiina kun saavut" },

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
