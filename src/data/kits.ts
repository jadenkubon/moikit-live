// MoiKit — single source of truth for kit data.
// Sell prices only — buy prices and margins are internal and never shown.

import { ITEM_IMAGES, type ItemImage } from "./itemImages";

export const SHIPPING_EUR = 20;

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
  tier: boolean;
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
    priceEur: 145,
    tier: true,
    badge: null,
    tagline: "A complete sleep setup — mattress, bedding and wardrobe basics for your first night.",
    blurb: "Mattress, fitted sheet, pillow, a bedding set in your choice of design, a light duvet and hangers.",
    highlights: [
      "Mattress (80×200) with fitted sheet",
      "Bedding set — 4 designs to choose from",
      "Pillow + light duvet",
      "10-pack of hangers",
    ],
    rooms: {
      bedroom: [
        { item: "Mattress (80×200)", eur: 75, img: "agotnes-mattress" },
        { item: "Fitted sheet — white (coloured options +€5)", eur: 10, img: "baerglim-sheet" },
        { item: "Pillow", eur: 10, img: "sandgrasmal-pillow" },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 25, img: "brunkrissla-bedding" },
        { item: "Light duvet", eur: 20, img: "sandgrasmal-duvet" },
        { item: "10-pack dark plastic hangers", eur: 5, img: "spruttig-hangers" },
      ],
    },
  },
  {
    slug: "premium",
    name: "Premium Kit",
    priceEur: 330,
    tier: true,
    badge: "Most popular",
    tagline: "A comfort upgrade — better mattress, high pillow and a duvet for every season.",
    blurb: "An upgraded mattress, high pillow, bedding set in your choice of design, warm and light duvets, and wooden hangers.",
    highlights: [
      "Upgraded mattress (80×200)",
      "High pillow (50×60 cm)",
      "Warm + light duvets",
      "Bedding set — 4 designs to choose from",
    ],
    rooms: {
      bedroom: [
        { item: "Upgraded mattress (80×200)", eur: 200, img: "vesteroy-mattress" },
        { item: "Fitted sheet — white (coloured options +€5)", eur: 10, img: "baerglim-sheet" },
        { item: "High pillow (50×60 cm)", eur: 30, img: "gaffelklocka-pillow" },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 30, img: "solfibbla-bedding" },
        { item: "Warm duvet", eur: 30, img: "safferot-duvet-warm" },
        { item: "Light duvet", eur: 20, img: "sandgrasmal-duvet" },
        { item: "8-pack wooden hangers", eur: 10, img: "bumerang-hangers" },
      ],
    },
  },
  {
    slug: "platinum",
    name: "Platinum Kit",
    priceEur: 610,
    tier: true,
    badge: "Most complete",
    tagline: "Top-of-the-line sleep — premium hybrid mattress and an ergonomic pillow.",
    blurb: "A premium hybrid mattress, ergonomic pillow, bedding set in your choice of design, warm and light duvets, and bamboo hangers.",
    highlights: [
      "Premium hybrid mattress (80×200)",
      "Ergonomic pillow (33×35 cm)",
      "Warm + light duvets",
      "Bedding set — 4 designs to choose from",
    ],
    rooms: {
      bedroom: [
        { item: "Premium hybrid mattress (80×200)", eur: 450, img: "anneland-mattress" },
        { item: "Fitted sheet — white (coloured options +€5)", eur: 10, img: "baerglim-sheet" },
        { item: "Ergonomic pillow (33×35 cm)", eur: 40, img: "rosenskarm-pillow" },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 40, img: "ektandvinge-bedding" },
        { item: "Warm duvet", eur: 30, img: "safferot-duvet-warm" },
        { item: "Light duvet", eur: 20, img: "sandgrasmal-duvet" },
        { item: "2× 5-pack bamboo hangers", eur: 20, img: "hosvans-hangers" },
      ],
    },
  },
  {
    slug: "kitchen",
    name: "Kitchen Kit",
    priceEur: 183,
    tier: false,
    badge: null,
    tagline: "Everything to cook and eat from day one — plates to pots.",
    blurb: "A full starter kitchen: tableware for four, cutlery, cookware, knives, storage and towels. Add appliances if you need them.",
    highlights: [
      "Plates, bowls, glasses & mugs",
      "16-piece cutlery set",
      "Pot, frying pan & 3 knives",
      "Appliance add-ons available",
    ],
    rooms: {
      kitchen: [
        { item: "Dish set — 4 large plates (26 cm)", eur: 20, img: "oftast-plate-large" },
        { item: "4 small dinner plates (21 cm)", eur: 16, img: "oftast-plate-small" },
        { item: "4 bowls (white, 20 cm)", eur: 16, img: "oftast-bowl" },
        { item: "Water glasses (6 × 27 cl)", eur: 15, img: "pokal-glass" },
        { item: "3 mugs (320 ml)", eur: 8, img: "tt-mug" },
        { item: "Cutlery set, 16 pieces", eur: 25, img: "mopsig-cutlery" },
        { item: "Pot with lid", eur: 15, img: "annons-pot" },
        { item: "Frying pan", eur: 15, img: "tagghaj-pan" },
        { item: "Spatula", eur: 6, img: "knorrhane-spatula" },
        { item: "Wooden spoon", eur: 6, img: "rort-spoon" },
        { item: "Knife set, 3 pieces", eur: 20, img: "andlig-knives" },
        { item: "Food storage containers (5-pack)", eur: 15, img: "havstobis-containers" },
        { item: "Kitchen towels (4-pack)", eur: 6, img: "rinnig-towels" },
      ],
      addons: [
        { item: "Coffee maker", eur: 35, addon: true, img: "tt-coffeemaker" },
        { item: "Microwave", eur: 100, addon: true, img: "tillreda-microwave" },
        { item: "Electric kettle (1.3 l)", eur: 35, addon: true, img: "tt-kettle" },
        { item: "Toaster", eur: 30, addon: true, img: "tt-toaster" },
      ],
    },
  },
  {
    slug: "bathroom",
    name: "Bathroom Kit",
    priceEur: 69,
    tier: false,
    badge: null,
    tagline: "Towels and toiletries, ready on the rack.",
    blurb: "Bath and hand towels plus the toiletries you'd otherwise buy on night one: toilet paper, soaps, shampoo and conditioner.",
    highlights: ["2 bath + 2 hand towels", "Toilet paper & soaps", "Shampoo + conditioner"],
    rooms: {
      bathroom: [
        { item: "2 bath towels (100×150 cm)", eur: 30, img: "vagsjon-bath-towel" },
        { item: "2 hand towels (30×50 cm)", eur: 5, img: "vagsjon-hand-towel" },
        { item: "Toilet paper (4 rolls)", eur: 10, img: "tt-toiletpaper" },
        { item: "Hand soap", eur: 5, img: "tt-handsoap" },
        { item: "Soap bar", eur: 5, img: "tt-soapbar" },
        { item: "Shampoo (250 ml)", eur: 7, img: "tt-shampoo" },
        { item: "Conditioner (200 ml)", eur: 7, img: "tt-conditioner" },
      ],
    },
  },
  {
    slug: "cleaning",
    name: "Cleaning Kit",
    priceEur: 52,
    tier: false,
    badge: null,
    tagline: "Every surface covered, from windows to dishes.",
    blurb: "Sprays, brushes, sponges and bags for keeping a new place clean. Add laundry gear if your building has a shared machine.",
    highlights: [
      "Sprays for every surface",
      "Dish detergent, sponges & brush",
      "Garbage + compost bags",
      "Laundry add-ons available",
    ],
    rooms: {
      cleaning: [
        { item: "Universal spray", eur: 7, img: "tt-universal-spray" },
        { item: "Window cleaner spray", eur: 6, img: "tt-window-spray" },
        { item: "Toilet bowl cleaner", eur: 6, img: "tt-toilet-cleaner" },
        { item: "Toilet brush", eur: 5, img: "bolmen-brush" },
        { item: "Dish detergent", eur: 5, img: "tt-dish-detergent" },
        { item: "Sponges (2-pack)", eur: 5, img: "tt-sponges" },
        { item: "Finnish dish brush", eur: 5, img: "tt-dish-brush" },
        { item: "Garbage bags (40 l)", eur: 5, img: "tt-garbage-bags" },
        { item: "Compost bags (75 l)", eur: 8, img: "tt-compost-bags" },
      ],
      addons: [
        { item: "Laundry basket", eur: 15, addon: true, img: "klunka-basket" },
        { item: "Laundry detergent", eur: 10, addon: true, img: "tt-laundry-detergent" },
      ],
    },
  },
];

export const ROOM_META: Record<string, { label: string }> = {
  bedroom: { label: "Bedroom" },
  kitchen: { label: "Kitchen" },
  bathroom: { label: "Bathroom" },
  cleaning: { label: "Cleaning" },
  addons: { label: "Add-ons" },
};

export const COMPARISON_ROWS = [
  { label: "Price", basic: "€145.00", premium: "€330.00", platinum: "€610.00" },
  { label: "Mattress (80×200)", basic: "Foam", premium: "Upgraded", platinum: "Premium hybrid" },
  { label: "Pillow", basic: "Standard", premium: "High (50×60)", platinum: "Ergonomic" },
  { label: "Duvets", basic: "Light", premium: "Warm + Light", platinum: "Warm + Light" },
  { label: "Bedding set", basic: "✓ 4 designs", premium: "✓ 4 designs", platinum: "✓ 4 designs" },
  { label: "Fitted sheet", basic: "White (colours +€5)", premium: "White (colours +€5)", platinum: "White (colours +€5)" },
  { label: "Hangers", basic: "10 plastic", premium: "8 wooden", platinum: "10 bamboo" },
];

export const FAQS = [
  {
    q: "Do I need to be home for the delivery?",
    a: "No. Tell us the address and your move-in date and we deliver so your kit is waiting. If you'd like it set up inside, mention it in your order notes.",
  },
  {
    q: "Can I change what's in a kit or order single items?",
    a: "Yes. Pick a kit as your base and tell us what to swap, add or drop — or order individual items. Message us and we'll build it for you.",
  },
  {
    q: "Where do you deliver?",
    a: "Lappeenranta and the surrounding area. We're based here, so most orders arrive quickly. Ask us if you're just outside the city.",
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

// Cross-sell runs across the two families: a sleep tier suggests the room kits,
// a room kit suggests the sleep tiers. Never recommends a kit against itself.
export const relatedKits = (kit: Kit) => KITS.filter((k) => k.tier !== kit.tier);
export const relatedLabel = (kit: Kit) =>
  kit.tier
    ? { eyebrow: "Complete the place", title: "Add a room kit." }
    : { eyebrow: "Still need a bed?", title: "Pick a sleep kit." };
export const allItems = (kit: Kit) => Object.values(kit.rooms).flat().filter((r) => !r.addon);
export const itemsTotal = (kit: Kit) => allItems(kit).reduce((s, r) => s + r.eur, 0);
export const itemCount = (kit: Kit) => allItems(kit).length;
export const eur = (n: number) => "€" + n.toFixed(2);
