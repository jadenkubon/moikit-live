// MoiKit — single source of truth for kit data.
// Sell prices only — buy prices and margins are internal and never shown.

export const SHIPPING_EUR = 20;

export interface KitItem {
  item: string;
  eur: number;
  addon?: boolean;
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
        { item: "Mattress (80×200)", eur: 75 },
        { item: "Fitted sheet — white (coloured options +€5)", eur: 10 },
        { item: "Pillow", eur: 10 },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 25 },
        { item: "Light duvet", eur: 20 },
        { item: "10-pack dark plastic hangers", eur: 5 },
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
        { item: "Upgraded mattress (80×200)", eur: 200 },
        { item: "Fitted sheet — white (coloured options +€5)", eur: 10 },
        { item: "High pillow (50×60 cm)", eur: 30 },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 30 },
        { item: "Warm duvet", eur: 30 },
        { item: "Light duvet", eur: 20 },
        { item: "8-pack wooden hangers", eur: 10 },
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
        { item: "Premium hybrid mattress (80×200)", eur: 450 },
        { item: "Fitted sheet — white (coloured options +€5)", eur: 10 },
        { item: "Ergonomic pillow (33×35 cm)", eur: 40 },
        { item: "Bedding set: duvet cover + pillowcase — 4 designs", eur: 40 },
        { item: "Warm duvet", eur: 30 },
        { item: "Light duvet", eur: 20 },
        { item: "2× 5-pack bamboo hangers", eur: 20 },
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
        { item: "Dish set — 4 large plates (26 cm)", eur: 20 },
        { item: "4 small dinner plates (21 cm)", eur: 16 },
        { item: "4 bowls (white, 20 cm)", eur: 16 },
        { item: "Water glasses (6 × 27 cl)", eur: 15 },
        { item: "3 mugs (320 ml)", eur: 8 },
        { item: "Cutlery set, 16 pieces", eur: 25 },
        { item: "Pot with lid", eur: 15 },
        { item: "Frying pan", eur: 15 },
        { item: "Spatula", eur: 6 },
        { item: "Wooden spoon", eur: 6 },
        { item: "Knife set, 3 pieces", eur: 20 },
        { item: "Food storage containers (5-pack)", eur: 15 },
        { item: "Kitchen towels (4-pack)", eur: 6 },
      ],
      addons: [
        { item: "Coffee maker", eur: 35, addon: true },
        { item: "Microwave", eur: 100, addon: true },
        { item: "Electric kettle (1.3 l)", eur: 35, addon: true },
        { item: "Toaster", eur: 30, addon: true },
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
        { item: "2 bath towels (100×150 cm)", eur: 30 },
        { item: "2 hand towels (30×50 cm)", eur: 5 },
        { item: "Toilet paper (4 rolls)", eur: 10 },
        { item: "Hand soap", eur: 5 },
        { item: "Soap bar", eur: 5 },
        { item: "Shampoo (250 ml)", eur: 7 },
        { item: "Conditioner (200 ml)", eur: 7 },
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
        { item: "Universal spray", eur: 7 },
        { item: "Window cleaner spray", eur: 6 },
        { item: "Toilet bowl cleaner", eur: 6 },
        { item: "Toilet brush", eur: 5 },
        { item: "Dish detergent", eur: 5 },
        { item: "Sponges (2-pack)", eur: 5 },
        { item: "Finnish dish brush", eur: 5 },
        { item: "Garbage bags (40 l)", eur: 5 },
        { item: "Compost bags (75 l)", eur: 8 },
      ],
      addons: [
        { item: "Laundry basket", eur: 15, addon: true },
        { item: "Laundry detergent", eur: 10, addon: true },
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
export const allItems = (kit: Kit) => Object.values(kit.rooms).flat().filter((r) => !r.addon);
export const itemsTotal = (kit: Kit) => allItems(kit).reduce((s, r) => s + r.eur, 0);
export const itemCount = (kit: Kit) => allItems(kit).length;
export const eur = (n: number) => "€" + n.toFixed(2);
