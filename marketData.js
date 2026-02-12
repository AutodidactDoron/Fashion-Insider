/**
 * Robust Local Database – Virtual API data.
 * mockInventory: 40+ real-world items (Sneakers, Streetwear, Casual).
 * id, name, brand, image, retailPrice (USD), resellPrice (USD).
 */

var mockInventory = [
  // ---------- SNEAKERS ----------
  { id: 1, name: 'Air Jordan 1 Retro High OG Chicago', brand: 'Nike', image: 'https://placehold.co/400x400/8b0000/ffffff?text=AJ1+Chicago', retailPrice: 180, resellPrice: 420 },
  { id: 2, name: 'Air Jordan 4 Retro Black Cat', brand: 'Nike', image: 'https://placehold.co/400x400/1a1a1a/ffffff?text=AJ4+Black+Cat', retailPrice: 200, resellPrice: 380 },
  { id: 3, name: 'Nike Dunk Low Panda', brand: 'Nike', image: 'https://placehold.co/400x400/333333/ffffff?text=Dunk+Panda', retailPrice: 100, resellPrice: 145 },
  { id: 4, name: 'Yeezy Slide Pure', brand: 'Adidas', image: 'https://placehold.co/400x400/e8e8e8/333333?text=Yeezy+Slide', retailPrice: 55, resellPrice: 95 },
  { id: 5, name: 'Adidas Samba OG White', brand: 'Adidas', image: 'https://placehold.co/400x400/ffffff/1a1a1a?text=Samba', retailPrice: 80, resellPrice: 120 },
  { id: 6, name: 'New Balance 550 White Green', brand: 'New Balance', image: 'https://placehold.co/400x400/1a3d1a/ffffff?text=550', retailPrice: 130, resellPrice: 195 },
  { id: 7, name: 'New Balance 9060 Phantom', brand: 'New Balance', image: 'https://placehold.co/400x400/2d2d2d/ffffff?text=9060', retailPrice: 150, resellPrice: 220 },
  { id: 8, name: 'Air Jordan 1 Low Shadow', brand: 'Nike', image: 'https://placehold.co/400x400/3d3d3d/ffffff?text=AJ1+Low', retailPrice: 110, resellPrice: 165 },
  { id: 9, name: 'Nike Air Force 1 White', brand: 'Nike', image: 'https://placehold.co/400x400/ffffff/333?text=AF1', retailPrice: 90, resellPrice: 115 },
  { id: 10, name: 'Yeezy Boost 350 V2 Zebra', brand: 'Adidas', image: 'https://placehold.co/400x400/1a1a1a/ffffff?text=350+Zebra', retailPrice: 220, resellPrice: 320 },
  { id: 11, name: 'Travis Scott x Air Jordan 1 Low', brand: 'Nike', image: 'https://placehold.co/400x400/4a3728/ffffff?text=TS+AJ1', retailPrice: 150, resellPrice: 1450 },
  { id: 12, name: 'Nike Vomero 5 Silver Grey', brand: 'Nike', image: 'https://placehold.co/400x400/808080/fff?text=Vomero+5', retailPrice: 160, resellPrice: 220 },
  { id: 13, name: 'Converse Chuck 70 High', brand: 'Converse', image: 'https://placehold.co/400x400/2c2c2c/ffffff?text=Chuck+70', retailPrice: 75, resellPrice: 85 },
  { id: 14, name: 'Salomon XT-6 Black', brand: 'Salomon', image: 'https://placehold.co/400x400/1a1a1a/ffffff?text=XT-6', retailPrice: 180, resellPrice: 210 },
  { id: 15, name: 'Asics Gel-Lyte III', brand: 'Asics', image: 'https://placehold.co/400x400/2d2d2d/ffffff?text=Gel-Lyte', retailPrice: 130, resellPrice: 115 },
  { id: 16, name: 'Air Jordan 3 Retro White Cement', brand: 'Nike', image: 'https://placehold.co/400x400/fff8e7/333?text=AJ3', retailPrice: 210, resellPrice: 280 },
  { id: 17, name: 'New Balance 2002R Protection Pack', brand: 'New Balance', image: 'https://placehold.co/400x400/4a4a4a/fff?text=2002R', retailPrice: 150, resellPrice: 260 },
  { id: 18, name: 'Nike Dunk Low Kentucky', brand: 'Nike', image: 'https://placehold.co/400x400/00471c/fff?text=Dunk+KY', retailPrice: 100, resellPrice: 135 },
  { id: 19, name: 'Adidas Gazelle Indoor', brand: 'Adidas', image: 'https://placehold.co/400x400/8b0000/fff?text=Gazelle', retailPrice: 100, resellPrice: 110 },
  { id: 20, name: 'Balenciaga Triple S White', brand: 'Balenciaga', image: 'https://placehold.co/400x400/f5f5f5/333?text=Triple+S', retailPrice: 850, resellPrice: 920 },
  // ---------- STREETWEAR ----------
  { id: 21, name: 'Nike Tech Fleece Joggers Grey', brand: 'Nike', image: 'https://placehold.co/400x400/5a5a5a/fff?text=Tech+Fleece', retailPrice: 100, resellPrice: 95 },
  { id: 22, name: 'Fear of God Essentials Hoodie Cream', brand: 'Fear of God', image: 'https://placehold.co/400x400/f5e6d3/333?text=FOG+Hoodie', retailPrice: 110, resellPrice: 185 },
  { id: 23, name: 'Stussy 8 Ball Fleece Tee', brand: 'Stussy', image: 'https://placehold.co/400x400/1a1a1a/fff?text=8+Ball', retailPrice: 68, resellPrice: 120 },
  { id: 24, name: 'Supreme Box Logo Hoodie Grey', brand: 'Supreme', image: 'https://placehold.co/400x400/4a4a4a/fff?text=Supreme', retailPrice: 168, resellPrice: 450 },
  { id: 25, name: 'Nike Sportswear Hoodie Black', brand: 'Nike', image: 'https://placehold.co/400x400/111/fff?text=Nike+Hoodie', retailPrice: 75, resellPrice: 70 },
  { id: 26, name: 'Stussy Basic Tee White', brand: 'Stussy', image: 'https://placehold.co/400x400/ffffff/333?text=Stussy+Tee', retailPrice: 45, resellPrice: 65 },
  { id: 27, name: 'Carhartt WIP Chase Jacket', brand: 'Carhartt WIP', image: 'https://placehold.co/400x400/3d2914/fff?text=Chase', retailPrice: 180, resellPrice: 165 },
  { id: 28, name: 'Palace Tri-Ferg Hoodie', brand: 'Palace', image: 'https://placehold.co/400x400/000/fff?text=Palace', retailPrice: 148, resellPrice: 220 },
  { id: 29, name: 'Kith Box Logo Hoodie', brand: 'Kith', image: 'https://placehold.co/400x400/2d2d2d/fff?text=Kith', retailPrice: 165, resellPrice: 240 },
  { id: 30, name: 'Off-White Arrow Tee', brand: 'Off-White', image: 'https://placehold.co/400x400/fff/000?text=OW+Arrow', retailPrice: 195, resellPrice: 280 },
  // ---------- CASUAL ----------
  { id: 31, name: 'Zara Wide Leg Jeans', brand: 'Zara', image: 'https://placehold.co/400x400/2c1810/fff?text=Zara+Jeans', retailPrice: 49, resellPrice: 35 },
  { id: 32, name: 'The North Face Nuptse Jacket Black', brand: 'The North Face', image: 'https://placehold.co/400x400/1a1a1a/fff?text=Nuptse', retailPrice: 270, resellPrice: 310 },
  { id: 33, name: 'Carhartt WIP Active Pants', brand: 'Carhartt WIP', image: 'https://placehold.co/400x400/3d3d1a/fff?text=WIP+Pants', retailPrice: 95, resellPrice: 85 },
  { id: 34, name: 'Zara Oversized Blazer', brand: 'Zara', image: 'https://placehold.co/400x400/2c2c2c/fff?text=Zara+Blazer', retailPrice: 89, resellPrice: 55 },
  { id: 35, name: 'The North Face Denali Fleece', brand: 'The North Face', image: 'https://placehold.co/400x400/0066cc/fff?text=Denali', retailPrice: 169, resellPrice: 145 },
  { id: 36, name: 'Zara Wool Blend Coat', brand: 'Zara', image: 'https://placehold.co/400x400/4a4a4a/fff?text=Zara+Coat', retailPrice: 129, resellPrice: 75 },
  { id: 37, name: 'Uniqlo Ultra Light Down Jacket', brand: 'Uniqlo', image: 'https://placehold.co/400x400/8b0000/fff?text=Ultra+Light', retailPrice: 69, resellPrice: 50 },
  { id: 38, name: 'Levi\'s 501 Original Jeans', brand: 'Levi\'s', image: 'https://placehold.co/400x400/1e3a5f/fff?text=501', retailPrice: 98, resellPrice: 70 },
  { id: 39, name: 'H&M Trench Coat', brand: 'H&M', image: 'https://placehold.co/400x400/4a4a4a/fff?text=H%26M+Trench', retailPrice: 79, resellPrice: 45 },
  { id: 40, name: 'Zara Ankle Boots Leather', brand: 'Zara', image: 'https://placehold.co/400x400/3d2914/fff?text=Zara+Boots', retailPrice: 79, resellPrice: 50 },
  { id: 41, name: 'Air Jordan 1 High UNC', brand: 'Nike', image: 'https://placehold.co/400x400/1e3a5f/fff?text=AJ1+UNC', retailPrice: 180, resellPrice: 290 },
  { id: 42, name: 'Nike Blazer Mid 77', brand: 'Nike', image: 'https://placehold.co/400x400/fff5e6/333?text=Blazer+77', retailPrice: 100, resellPrice: 105 },
  { id: 43, name: 'Bape Sta Low White', brand: 'Bape', image: 'https://placehold.co/400x400/fff/333?text=Bape+Sta', retailPrice: 180, resellPrice: 250 },
  { id: 44, name: 'Comme des Garçons Play Heart Tee', brand: 'Comme des Garçons', image: 'https://placehold.co/400x400/fff/000?text=CDG+Play', retailPrice: 125, resellPrice: 165 },
  { id: 45, name: 'Zara Tailored Trousers', brand: 'Zara', image: 'https://placehold.co/400x400/2d2d2d/fff?text=Zara+Trousers', retailPrice: 59, resellPrice: 38 },
];

if (typeof window !== 'undefined') {
  window.mockInventory = mockInventory;
}
