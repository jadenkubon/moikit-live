// MoiKit — single source of truth for kit data.
// Sell prices only — buy prices and margins are internal and never shown.
//
// Model (since 2026-07 order-form revamp): each kit is a full three-room
// bundle (bedroom + kitchen + bathroom) and every room is itself orderable —
// the builder lets a customer drop whole rooms or single items. Kit prices
// are strictly the sum of their items; where the order form's stated price
// disagreed with its own itemized list, the itemized prices won.

import { ITEM_IMAGES, type ItemImage } from "./itemImages";

export const SHIPPING_EUR = 30; // delivered in cooperation with LOAS

export interface KitItem {
  item: string;
  eur: number;
  addon?: boolean;
  /** Key into ITEM_IMAGES. Stable across re-encodes; the hashed filenames are generated. */
  img?: string;
}

export interface Kit {
  slug: string;
  name: string;
  priceEur: number;
  badge: string | null;
  tagline: string;
  blurb: string;
  highlights: string[];
  rooms: Record<string, KitItem[]>;
}

export const KITS: Kit[] = [
  {
    slug: "basic",
    name: "Basic Kit",
    priceEur: 240,
    badge: null,
    tagline: "A complete one-person setup — bed, a place setting and the bathroom basics.",
    blurb: "Everything one person needs on night one: mattress and bedding, a single place setting with pan and cutlery, plus towel, soap and toilet paper.",
    highlights: [
      "Mattress (80×200) + full bedding",
      "1 place setting, pan & 16-pc cutlery",
      "Towel, soap & toilet paper",
      "Bedding set — 4 designs to choose from",
    ],
    rooms: {
      bedroom: [
        { item: "Mattress (80×200)", eur: 75, img: "agotnes-mattress" },
        { item: "Fitted sheet", eur: 10, img: "baerglim-sheet" },
        { item: "Pillow", eur: 10, img: "sandgrasmal-pillow" },
        { item: "Light duvet", eur: 20, img: "sandgrasmal-duvet" },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 25, img: "brunkrissla-bedding" },
        { item: "10-pack plastic hangers", eur: 10, img: "spruttig-hangers" },
      ],
      kitchen: [
        { item: "1 large plate", eur: 5, img: "oftast-plate-large" },
        { item: "1 small plate", eur: 5, img: "oftast-plate-small" },
        { item: "1 bowl", eur: 5, img: "oftast-bowl" },
        { item: "1 water glass", eur: 5, img: "pokal-glass" },
        { item: "1 mug", eur: 5, img: "tt-mug" },
        { item: "Cutlery set, 16 pieces", eur: 15, img: "mopsig-cutlery" },
        { item: "Frying pan", eur: 15, img: "tagghaj-pan" },
        { item: "Spatula", eur: 10, img: "maku-spatula" },
      ],
      bathroom: [
        { item: "Bath towel", eur: 10, img: "vagsjon-bath-towel" },
        { item: "Soap bar", eur: 5, img: "tt-soapbar" },
        { item: "Toilet paper (4 rolls)", eur: 10, img: "tt-toiletpaper" },
      ],
    },
  },
  {
    slug: "premium",
    name: "Premium Kit",
    priceEur: 310,
    badge: "Most popular",
    tagline: "Room for two — double the place settings and a warmer, comfier bed.",
    blurb: "A medium mattress with high pillow and a warm duvet, two full place settings with a 24-piece cutlery set, and a fuller bathroom.",
    highlights: [
      "Medium mattress + high pillow",
      "Warm duvet",
      "2 place settings, 24-pc cutlery",
      "Bath + hand towel",
    ],
    rooms: {
      bedroom: [
        { item: "Medium mattress (80×200)", eur: 75, img: "agotnes-mattress" },
        { item: "Fitted sheet", eur: 10, img: "baerglim-sheet" },
        { item: "High pillow (50×60 cm)", eur: 20, img: "gaffelklocka-pillow" },
        { item: "Warm duvet", eur: 30, img: "safferot-duvet-warm" },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 25, img: "solfibbla-bedding" },
        { item: "8-pack wooden hangers", eur: 15, img: "bumerang-hangers" },
      ],
      kitchen: [
        { item: "2 large plates", eur: 10, img: "oftast-plate-large" },
        { item: "2 small plates", eur: 10, img: "oftast-plate-small" },
        { item: "2 bowls", eur: 10, img: "oftast-bowl" },
        { item: "2 water glasses", eur: 10, img: "pokal-glass" },
        { item: "2 mugs", eur: 10, img: "tt-mug" },
        { item: "Cutlery set, 24 pieces", eur: 20, img: "mopsig-cutlery" },
        { item: "Frying pan", eur: 15, img: "tagghaj-pan" },
        { item: "Spatula", eur: 10, img: "maku-spatula" },
        { item: "Kitchen towels (2-pack)", eur: 5, img: "rinnig-towels" },
      ],
      bathroom: [
        { item: "Bath towel", eur: 15, img: "vagsjon-bath-towel" },
        { item: "Soap bar", eur: 5, img: "tt-soapbar" },
        { item: "Toilet paper (4 rolls)", eur: 10, img: "tt-toiletpaper" },
        { item: "Hand towel", eur: 5, img: "vagsjon-hand-towel" },
      ],
    },
  },
  {
    slug: "platinum",
    name: "Platinum Kit",
    priceEur: 475,
    badge: "Most complete",
    tagline: "The full household — four place settings, both duvets and a spare of everything.",
    blurb: "A high-quality mattress with ergonomic pillow, warm and light duvets with a spare sheet, four full place settings, and a doubled-up bathroom.",
    highlights: [
      "High-quality mattress + ergonomic pillow",
      "Warm + light duvets, 2 fitted sheets",
      "4 place settings, 24-pc cutlery",
      "2 bath + 2 hand towels",
    ],
    rooms: {
      bedroom: [
        { item: "High-quality mattress (80×200)", eur: 125, img: "falninga-mattress" },
        { item: "2 fitted sheets", eur: 20, img: "baerglim-sheet" },
        { item: "Ergonomic pillow (33×35 cm)", eur: 25, img: "rosenskarm-pillow" },
        { item: "Warm duvet", eur: 30, img: "safferot-duvet-warm" },
        { item: "Light duvet", eur: 20, img: "sandgrasmal-duvet" },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 25, img: "ektandvinge-bedding" },
        { item: "2× 5-pack bamboo hangers", eur: 20, img: "hosvans-hangers" },
      ],
      kitchen: [
        { item: "4 large plates", eur: 20, img: "oftast-plate-large" },
        { item: "4 small plates", eur: 20, img: "oftast-plate-small" },
        { item: "4 bowls", eur: 20, img: "oftast-bowl" },
        { item: "4 water glasses", eur: 20, img: "pokal-glass" },
        { item: "4 mugs", eur: 20, img: "tt-mug" },
        { item: "Cutlery set, 24 pieces", eur: 20, img: "mopsig-cutlery" },
        { item: "Frying pan", eur: 15, img: "tagghaj-pan" },
        { item: "Spatula", eur: 5, img: "maku-spatula" },
        { item: "Kitchen towels (4-pack)", eur: 10, img: "rinnig-towels" },
      ],
      bathroom: [
        { item: "2 bath towels", eur: 30, img: "vagsjon-bath-towel" },
        { item: "Soap bar", eur: 5, img: "tt-soapbar" },
        { item: "Toilet paper (6 rolls)", eur: 15, img: "tt-toiletpaper" },
        { item: "2 hand towels", eur: 10, img: "vagsjon-hand-towel" },
      ],
    },
  },
];

export const ROOM_META: Record<string, { label: string }> = {
  bedroom: { label: "Bedroom" },
  kitchen: { label: "Kitchen" },
  bathroom: { label: "Bathroom" },
};

export const COMPARISON_ROWS = [
  { label: "Price", basic: "€240.00", premium: "€310.00", platinum: "€475.00" },
  { label: "Mattress (80×200)", basic: "Foam", premium: "Medium", platinum: "High quality" },
  { label: "Pillow", basic: "Standard", premium: "High (50×60)", platinum: "Ergonomic" },
  { label: "Duvets", basic: "Light", premium: "Warm", platinum: "Warm + Light" },
  { label: "Fitted sheets", basic: "1", premium: "1", platinum: "2" },
  { label: "Place settings", basic: "1", premium: "2", platinum: "4" },
  { label: "Cutlery set", basic: "16 pieces", premium: "24 pieces", platinum: "24 pieces" },
  { label: "Towels", basic: "1 bath", premium: "1 bath + 1 hand", platinum: "2 bath + 2 hand" },
  { label: "Hangers", basic: "10 plastic", premium: "8 wooden", platinum: "10 bamboo" },
];

export const FAQS = [
  {
    q: "Do I need to be home for the delivery?",
    a: "No. Tell us the address and your move-in date and we deliver so your kit is waiting. Delivery is €30, handled in cooperation with LOAS. If you'd like it set up inside, mention it in your order notes.",
  },
  {
    q: "Can I change what's in a kit or order a single room?",
    a: "Yes. Every kit is split into bedroom, kitchen and bathroom — drop a whole room or single items in the builder and the price follows. Only need a mattress? Drop everything else.",
  },
  {
    q: "Where do you deliver?",
    a: "Lappeenranta and the surrounding area, in cooperation with LOAS. We're based here, so most orders arrive quickly. Ask us if you're just outside the city.",
  },
  {
    q: "How do I pay?",
    a: "Checkout is handled by Paytrail — Finland's standard payment service. Pay by card, MobilePay or your own online bank.",
  },
  {
    q: "What if something arrives damaged?",
    a: "Message us with a photo and we'll replace it. We want your first night to feel like home, not a hassle.",
  },
];

export const kitBySlug = (slug: string) => KITS.find((k) => k.slug === slug) ?? KITS[0];
export const kitHref = (slug: string) => `/kits/${slug}/`;
export const itemImg = (r: KitItem): ItemImage | null => (r.img ? ITEM_IMAGES[r.img] ?? null : null);

// Cross-sell: with three full bundles there's one family, so each kit page
// simply recommends the other two tiers.
export const relatedKits = (kit: Kit) => KITS.filter((k) => k.slug !== kit.slug);
export const relatedLabel = (_kit: Kit) => ({
  eyebrow: "Not quite right?",
  title: "See the other tiers.",
});

export const allItems = (kit: Kit) => Object.values(kit.rooms).flat().filter((r) => !r.addon);
export const itemsTotal = (kit: Kit) => allItems(kit).reduce((s, r) => s + r.eur, 0);
export const itemCount = (kit: Kit) => allItems(kit).length;
export const roomTotal = (kit: Kit, room: string) =>
  (kit.rooms[room] ?? []).filter((r) => !r.addon).reduce((s, r) => s + r.eur, 0);
export const eur = (n: number) => "€" + n.toFixed(2);
