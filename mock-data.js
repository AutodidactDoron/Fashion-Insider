/**
 * Mock product data – no database. Used for dashboard grid, price list, and trade modal.
 * Each product has: id, name, brand, price (current CR), priceLow, priceHigh (range in $), imageURL, priceHistory (for mini graph).
 * Price history is generated from the item's real price range (priceLow–priceHigh) so charts show real prices.
 */

function generatePriceHistory(days, basePrice, variance) {
  var history = [];
  var now = new Date();
  for (var d = days - 1; d >= 0; d--) {
    var date = new Date(now);
    date.setDate(date.getDate() - d);
    var val = basePrice + (Math.random() - 0.5) * variance;
    history.push({ date: date.toISOString().slice(0, 10), value: Math.round(val) });
  }
  return history;
}

/** Generate price history within the item's real market range (priceLow–priceHigh). Values stay inside the range for a realistic chart. */
function generatePriceHistoryFromRange(days, priceLow, priceHigh) {
  var history = [];
  var now = new Date();
  var range = Math.max(priceHigh - priceLow, 1);
  var mid = (priceLow + priceHigh) / 2;
  var variance = range * 0.25;
  for (var d = days - 1; d >= 0; d--) {
    var date = new Date(now);
    date.setDate(date.getDate() - d);
    var val = mid + (Math.random() - 0.5) * variance * (0.9 + Math.random() * 0.2);
    val = Math.max(priceLow, Math.min(priceHigh, val));
    history.push({ date: date.toISOString().slice(0, 10), value: Math.round(val) });
  }
  return history;
}

// Base path for uploaded images (place in assets/ folder; fallback to placeholder if missing)
var ASSETS = 'assets/';

window.products = [
  {
    id: 'p1',
    name: 'Nike Air Force 1 White',
    brand: 'Nike',
    price: 950,
    priceLow: 85,
    priceHigh: 120,
    imageURL: ASSETS + 'nike-air-force-1.png',
    priceHistory: generatePriceHistoryFromRange(14, 85, 120)
  },
  {
    id: 'p2',
    name: 'Nike Vomero 5 Silver Grey',
    brand: 'Nike',
    price: 2200,
    priceLow: 180,
    priceHigh: 240,
    imageURL: ASSETS + 'nike-vomero-5.png',
    priceHistory: generatePriceHistoryFromRange(14, 180, 240)
  },
  {
    id: 'p3',
    name: 'New Balance 9060 Phantom',
    brand: 'New Balance',
    price: 1850,
    priceLow: 150,
    priceHigh: 220,
    imageURL: ASSETS + 'new-balance-9060.png',
    priceHistory: generatePriceHistoryFromRange(14, 150, 220)
  },
  {
    id: 'p4',
    name: 'Air Jordan 1 Retro High Chicago',
    brand: 'Nike',
    price: 2850,
    priceLow: 280,
    priceHigh: 450,
    imageURL: 'https://placehold.co/400x300/8b0000/ffffff?text=AJ1+Chicago',
    priceHistory: generatePriceHistoryFromRange(14, 280, 450),
    variations: [
      { id: 'p4-v1', name: 'Chicago (2023)', brand: 'Nike', imageURL: 'https://placehold.co/400x300/8b0000/ffffff?text=Chicago+23', price: 2900, priceLow: 285, priceHigh: 460, priceHistory: generatePriceHistoryFromRange(14, 285, 460) },
      { id: 'p4-v2', name: 'Lost & Found', brand: 'Nike', imageURL: 'https://placehold.co/400x300/5c4033/ffffff?text=Lost+Found', price: 3100, priceLow: 300, priceHigh: 480, priceHistory: generatePriceHistoryFromRange(14, 300, 480) }
    ]
  },
  {
    id: 'p5',
    name: 'Nike Dunk Low Panda',
    brand: 'Nike',
    price: 1200,
    priceLow: 100,
    priceHigh: 160,
    imageURL: 'https://placehold.co/400x300/333333/ffffff?text=Dunk+Panda',
    priceHistory: generatePriceHistoryFromRange(14, 100, 160),
    variations: [
      { id: 'p5-v1', name: 'Black & White', brand: 'Nike', imageURL: 'https://placehold.co/400x300/333333/ffffff?text=Dunk+B%26W', price: 1150, priceLow: 95, priceHigh: 155, priceHistory: generatePriceHistoryFromRange(14, 95, 155) },
      { id: 'p5-v2', name: 'University Blue', brand: 'Nike', imageURL: 'https://placehold.co/400x300/1e3a5f/ffffff?text=Dunk+Blue', price: 1280, priceLow: 105, priceHigh: 165, priceHistory: generatePriceHistoryFromRange(14, 105, 165) }
    ]
  },
  {
    id: 'p6',
    name: 'Yeezy Boost 350 V2 Zebra',
    brand: 'Adidas',
    price: 3200,
    priceLow: 280,
    priceHigh: 380,
    imageURL: 'https://placehold.co/400x300/1a1a1a/ffffff?text=350+Zebra',
    priceHistory: generatePriceHistoryFromRange(14, 280, 380)
  },
  {
    id: 'p7',
    name: 'Travis Scott x Air Jordan 1 Low',
    brand: 'Nike',
    price: 14500,
    priceLow: 1200,
    priceHigh: 1600,
    imageURL: 'https://placehold.co/400x300/4a3728/ffffff?text=TS+AJ1',
    priceHistory: generatePriceHistoryFromRange(14, 1200, 1600)
  },
  {
    id: 'p8',
    name: 'New Balance 550 White Green',
    brand: 'New Balance',
    price: 1850,
    priceLow: 140,
    priceHigh: 200,
    imageURL: 'https://placehold.co/400x300/1a3d1a/ffffff?text=550',
    priceHistory: generatePriceHistoryFromRange(14, 140, 200)
  },
  {
    id: 'p9',
    name: 'Adidas Samba White',
    brand: 'Adidas',
    price: 780,
    priceLow: 65,
    priceHigh: 95,
    imageURL: 'https://placehold.co/400x300/ffffff/1a1a1a?text=Samba',
    priceHistory: generatePriceHistoryFromRange(14, 65, 95)
  },
  {
    id: 'p10',
    name: 'Salomon XT-6 Black',
    brand: 'Salomon',
    price: 1950,
    priceLow: 160,
    priceHigh: 220,
    imageURL: 'https://placehold.co/400x300/1a1a1a/ffffff?text=XT-6',
    priceHistory: generatePriceHistoryFromRange(14, 160, 220)
  },
  {
    id: 'p11',
    name: 'Asics Gel-Lyte III',
    brand: 'Asics',
    price: 1100,
    priceLow: 90,
    priceHigh: 140,
    imageURL: 'https://placehold.co/400x300/2d2d2d/ffffff?text=Gel-Lyte',
    priceHistory: generatePriceHistoryFromRange(14, 90, 140)
  },
  {
    id: 'p12',
    name: 'Converse Chuck 70 High',
    brand: 'Converse',
    price: 650,
    priceLow: 55,
    priceHigh: 85,
    imageURL: 'https://placehold.co/400x300/2c2c2c/ffffff?text=Chuck+70',
    priceHistory: generatePriceHistoryFromRange(14, 55, 85)
  }
];

// Backward compatibility for any code that still expects SNEAKER_PRODUCTS (name, price, imageURL)
window.SNEAKER_PRODUCTS = window.products.map(function (p) {
  return { name: p.name, price: p.price, imageURL: p.imageURL, id: p.id };
});
