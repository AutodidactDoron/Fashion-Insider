/**
 * Market Service – Live Supabase Cloud Database.
 * fetchItems, addItem, deleteItem. Price List uses cloud data; fallback to mockInventory if empty/fail.
 */

const SUPABASE_URL = 'https://muwybkkadpqycpfhisyb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VUiV54FM5AZjcrE_1Dyvgw_pp_94Ok3';
let supabase = null;
try {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase load failed, using local fallback:', e);
}

const LATENCY_MS = 300;
const USD_TO_ILS = 3.8;
const TAX_RATE = 1.2;
const USED_DISCOUNT = 0.6;

/**
 * Fetch all items from Supabase (ordered by id desc). Returns [] if not connected.
 */
async function fetchItems() {
  if (!supabase) return (typeof window !== 'undefined' && window.mockInventory) ? window.mockInventory.slice() : [];
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('id', { ascending: false });
  if (error) console.error('Error fetching items:', error);
  return data || [];
}

/**
 * Insert one item. Shape: { name, price, image, owner }.
 */
async function addItem(item) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('items')
    .insert([{
      name: item.name,
      price: item.price,
      image: item.image,
      owner: item.owner
    }]);
  if (error) console.error('Error adding item:', error);
  return !error;
}

/**
 * Delete item by id.
 */
async function deleteItem(itemId) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId);
  if (error) console.error('Error deleting item:', error);
  return !error;
}

/**
 * Update item by id. updates: { name?, price?, image?, owner? }
 */
async function updateItem(itemId, updates) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', itemId);
  if (error) console.error('Error updating item:', error);
  return !error;
}

function priceToILS(usd, isUsed) {
  if (usd == null || isNaN(usd)) return 0;
  var ils = (usd * USD_TO_ILS * TAX_RATE);
  if (isUsed) ils = ils * USED_DISCOUNT;
  return Math.round(ils);
}

function generatePriceHistory(resellPrice) {
  var hist = [];
  var now = new Date();
  var base = resellPrice || 100;
  var variance = base * 0.08;
  for (var i = 13; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var val = base + (Math.random() - 0.5) * variance;
    hist.push({ date: d.toISOString().slice(0, 10), value: Math.round(val * 100) / 100 });
  }
  return hist;
}

/**
 * Normalize DB row or mock item to Price List shape.
 * DB row: id, name, price, image, owner (optional brand, retail_price, resell_price).
 */
function normalizeItem(raw) {
  var price = raw.price != null ? Number(raw.price) : 0;
  var retail = raw.retail_price != null ? Number(raw.retail_price) : (price * 0.85);
  var resell = raw.resell_price != null ? Number(raw.resell_price) : price;
  var brand = raw.brand || raw.owner || 'User';
  var hist = generatePriceHistory(resell);
  return {
    id: String(raw.id),
    name: raw.name,
    brand: brand,
    imageURL: raw.image,
    image: raw.image,
    retailPrice: retail,
    resellPrice: resell,
    price: resell,
    priceLow: retail,
    priceHigh: resell,
    priceHistory: hist,
    _fromMarket: true,
    owner: raw.owner
  };
}

/**
 * Search: fetch from Supabase, filter by query on name or brand, return normalized.
 * Fallback: if fetch fails or returns empty, use window.mockInventory when available.
 */
function searchMarketItems(query) {
  var q = (query || '').trim().toLowerCase();
  return fetchItems()
    .then(function (rows) {
      var list = (rows && rows.length) ? rows : (typeof window !== 'undefined' && window.mockInventory) ? window.mockInventory.slice() : [];
      var filtered = q
        ? list.filter(function (item) {
            var name = (item.name || '').toLowerCase();
            var brand = (item.brand || item.owner || '').toLowerCase();
            return name.indexOf(q) >= 0 || brand.indexOf(q) >= 0;
          })
        : list.slice();
      var normalized = filtered.map(normalizeItem);
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(normalized); }, LATENCY_MS);
      });
    })
    .catch(function (err) {
      console.error('searchMarketItems:', err);
      var list = (typeof window !== 'undefined' && window.mockInventory) ? window.mockInventory.slice() : [];
      var filtered = q
        ? list.filter(function (item) {
            var name = (item.name || '').toLowerCase();
            var brand = (item.brand || '').toLowerCase();
            return name.indexOf(q) >= 0 || brand.indexOf(q) >= 0;
          })
        : list.slice();
      return Promise.resolve(filtered.map(normalizeItem));
    });
}

function getItemById(id) {
  return fetchItems().then(function (rows) {
    var raw = (rows || []).filter(function (item) { return String(item.id) === String(id); })[0];
    return raw ? normalizeItem(raw) : null;
  });
}

window.marketService = {
  fetchItems: fetchItems,
  addItem: addItem,
  deleteItem: deleteItem,
  updateItem: updateItem,
  searchMarketItems: searchMarketItems,
  getItemById: getItemById,
  priceToILS: priceToILS,
  getPriceHistory: function (item) {
    return item && item.priceHistory ? item.priceHistory : generatePriceHistory(item && item.resellPrice);
  },
  USD_TO_ILS: USD_TO_ILS,
  TAX_RATE: TAX_RATE,
  USED_DISCOUNT: USED_DISCOUNT
};

// Load app.js after marketService is ready (modules run deferred)
var appScript = document.createElement('script');
appScript.src = 'app.js';
document.body.appendChild(appScript);
