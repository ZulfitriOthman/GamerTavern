// src/data/products.js

export const TCG_LIST = [
  { id: "mtg", name: "Magic: The Gathering", color: "from-purple-500 to-indigo-500" },
  { id: "ygo", name: "Yu-Gi-Oh!", color: "from-yellow-400 to-amber-600" },
  { id: "pokémon", name: "Pokémon TCG", color: "from-sky-400 to-blue-500" },
  { id: "vanguard", name: "Cardfight!! Vanguard", color: "from-emerald-400 to-teal-500" },
];

export const PRODUCTS = [
  {
    id: "mtg-boost-1",
    tcg: "mtg",
    name: "MTG Draft Booster Box – Wilds of Eldraine",
    rarity: "Booster Box",
    price: 450,
    stock: 5,
    image:
      "https://images.pexels.com/photos/279321/pexels-photo-279321.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "mtg-single-1",
    tcg: "mtg",
    name: "Liliana of the Veil (Ultimate Masters)",
    rarity: "Mythic Rare",
    price: 95,
    stock: 2,
    image:
      "https://images.pexels.com/photos/775907/pexels-photo-775907.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "ygo-boost-1",
    tcg: "ygo",
    name: "Yu-Gi-Oh! Legendary Duelists Booster Box",
    rarity: "Booster Box",
    price: 380,
    stock: 3,
    image:
      "https://images.pexels.com/photos/775907/pexels-photo-775907.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "poke-elite-1",
    tcg: "pokémon",
    name: "Pokémon Elite Trainer Box – Scarlet & Violet",
    rarity: "Elite Trainer Box",
    price: 320,
    stock: 4,
    image:
      "https://images.pexels.com/photos/1310847/pexels-photo-1310847.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "vgd-start-1",
    tcg: "vanguard",
    name: "Vanguard Start Deck – Keter Sanctuary",
    rarity: "Start Deck",
    price: 60,
    stock: 10,
    image:
      "https://images.pexels.com/photos/1310847/pexels-photo-1310847.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];
