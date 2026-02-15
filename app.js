/**
 * Mock logic – no backend. Dynamic products, grid render, and all button interactions.
 */

(function () {
  'use strict';

  var PLACEHOLDER_IMG = 'https://placehold.co/400x300/1a1a1a/666?text=No+Image';

  // ---------------------------------------------------------------------------
  // State (in-memory only)
  // ---------------------------------------------------------------------------
  var likedIds = {}; // product id -> true
  var balance = parseInt(localStorage.getItem('fashionInsider_balance'), 10) || 5450;
  var FIRST_BUY_KEY = 'fashionInsider_firstBuyDone';
  var TRADE_FEE_CR = 25;
  var pendingBuyProduct = null;

  // ---------------------------------------------------------------------------
  // Currency: USD is source of truth; ILS uses live rate (set by PS settings)
  // ---------------------------------------------------------------------------
  if (typeof window.currentCurrency === 'undefined') window.currentCurrency = localStorage.getItem('ps-currency') || 'USD';
  if (typeof window.usdToIlsRate === 'undefined') window.usdToIlsRate = parseFloat(localStorage.getItem('ps-usd-to-ils-rate'), 10) || 1;

  var USD_TO_CR = 100;

  function formatPriceRange(low, high) {
    var cur = window.currentCurrency || 'USD';
    var rate = cur === 'ILS' ? (window.usdToIlsRate || 1) : 1;
    var sym = cur === 'ILS' ? '₪' : '$';
    return sym + Math.round(low * rate) + ' – ' + sym + Math.round(high * rate);
  }

  function formatPriceRangeCR(low, high) {
    var lowCR = Math.round(low * USD_TO_CR);
    var highCR = Math.round(high * USD_TO_CR);
    return lowCR.toLocaleString() + ' – ' + highCR.toLocaleString() + ' CR';
  }

  function formatPriceEquiv(priceUsd) {
    var cur = window.currentCurrency || 'USD';
    var rate = cur === 'ILS' ? (window.usdToIlsRate || 1) : 1;
    var sym = cur === 'ILS' ? '₪' : '$';
    var val = priceUsd * rate;
    return cur === 'ILS' ? sym + Math.round(val).toLocaleString() : sym + val.toFixed(2);
  }

  function formatPriceChange(delta) {
    var cur = window.currentCurrency || 'USD';
    var rate = cur === 'ILS' ? (window.usdToIlsRate || 1) : 1;
    var sym = cur === 'ILS' ? '₪' : '$';
    var val = Math.round(Math.abs(delta) * rate);
    return delta >= 0 ? '↑ +' + sym + val : '↓ -' + sym + val;
  }

  // ---------------------------------------------------------------------------
  // Mini price graph: build bar HTML from priceHistory
  // ---------------------------------------------------------------------------
  function renderMiniGraph(priceHistory) {
    if (!priceHistory || !priceHistory.length) return '';
    var max = Math.max.apply(null, priceHistory.map(function (h) { return h.value; }));
    var min = Math.min.apply(null, priceHistory.map(function (h) { return h.value; }));
    var range = max - min || 1;
    var bars = priceHistory.map(function (h) {
      var pct = ((h.value - min) / range) * 100;
      return '<span class="price-bar" style="height:' + pct + '%"></span>';
    }).join('');
    return '<div class="mini-price-graph flex items-end gap-0.5 h-8 w-full">' + bars + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Build one product card HTML (with heart, graph, price range, Trade, BUY)
  // ---------------------------------------------------------------------------
  function buildProductCard(p) {
    var priceRangeCR = formatPriceRangeCR(p.priceLow, p.priceHigh);
    var graphHtml = renderMiniGraph(p.priceHistory);
    var heartClass = likedIds[p.id] ? 'text-red-500' : 'text-gray-400';
    return (
      '<div class="product-card bg-card rounded-xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-300" data-product-id="' + p.id + '">' +
        '<div class="product-card-img-wrap relative h-44 bg-gray-800 flex items-center justify-center overflow-hidden" data-product-id="' + p.id + '" data-tooltip="Click to open price chart and details">' +
          '<img src="' + p.imageURL + '" alt="' + p.name + '" class="product-card-img absolute inset-0 w-full h-full object-cover object-center bg-gray-800" onerror="this.src=\'' + PLACEHOLDER_IMG + '\'" />' +
          '<div class="absolute top-2 left-2 flex items-center gap-1">' +
            '<span class="px-2 py-0.5 rounded bg-fi-success/90 text-white text-xs font-medium">DS</span>' +
            '<button type="button" class="btn-heart p-1.5 rounded-full hover:bg-white/10 transition-colors ' + heartClass + '" data-product-id="' + p.id + '" aria-label="Like" data-tooltip="Like or save this item">' +
              '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="absolute top-2 right-2 px-2 py-0.5 rounded bg-fi-success/20 text-fi-success text-xs font-medium">+' + (Math.round((p.priceHigh - p.priceLow) / p.priceLow * 10) || 0) + '%</div>' +
        '</div>' +
        '<div class="p-4">' +
          '<h3 class="font-bold text-white truncate">' + p.name + '</h3>' +
          '<p class="text-gray-400 text-sm">' + p.brand + '</p>' +
          '<div class="mt-2 text-xs text-gray-500">Price range</div>' +
          '<div class="text-white font-mono font-semibold text-sm">' + priceRangeCR + '</div>' +
          '<div class="mt-2">' + graphHtml + '</div>' +
          '<div class="mt-3 flex items-end justify-between gap-2">' +
            '<div><div class="text-xs text-gray-400">PRICE</div><div class="text-fi-success text-lg font-bold">' + Number(p.price).toLocaleString() + ' CR</div></div>' +
            '<div class="flex gap-2">' +
              '<button type="button" class="btn-trade px-3 py-2 rounded-lg bg-fi-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity" data-product-id="' + p.id + '" data-tooltip="Open trade screen for this item">Trade</button>' +
              '<button type="button" class="btn-buy px-3 py-2 rounded-lg bg-fi-success text-white text-xs font-bold hover:opacity-90 transition-opacity" data-product-id="' + p.id + '" data-tooltip="Buy now with your credits">BUY</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------------------
  // Render full grid from products array
  // ---------------------------------------------------------------------------
  function renderProductGrid() {
    var grid = document.getElementById('sneaker-grid');
    var list = window.products;
    if (!grid || !list || !list.length) return;
    grid.innerHTML = list.map(buildProductCard).join('');

    // Stats row: update from products (credits only)
    var avgPrice = Math.round(list.reduce(function (sum, p) { return sum + p.price; }, 0) / list.length);
    var avgEl = document.querySelector('#dashboard-section .grid.grid-cols-4 .text-2xl.font-bold');
    if (avgEl && avgEl.closest('.bg-card')) {
      var cards = document.querySelectorAll('#dashboard-section .grid.grid-cols-4 .bg-card');
      if (cards[1]) cards[1].querySelector('.text-2xl').textContent = avgPrice.toLocaleString() + ' CR';
    }
    var listingEl = document.querySelector('#dashboard-section .grid.grid-cols-4 .bg-card .text-2xl');
    if (listingEl) listingEl.textContent = list.length;
  }

  // ---------------------------------------------------------------------------
  // Trade modal (catalog + Your offer vs Their offer + credits)
  // ---------------------------------------------------------------------------
  var tradeModal = document.getElementById('trade-modal');
  var tradeModalBackdrop = document.getElementById('trade-modal-backdrop');
  var tradeModalClose = document.getElementById('trade-modal-close');
  var tradePartnerLabel = document.getElementById('trade-partner-label');

  var yourOfferItems = [];   // array of product objects
  var yourOfferCredits = 0;

  function renderTradeCatalog(filter) {
    var listEl = document.getElementById('trade-catalog-list');
    if (!listEl || !window.products) return;
    var q = (filter || '').toLowerCase().trim();
    var products = window.products.filter(function (p) {
      if (!q) return true;
      return (p.name && p.name.toLowerCase().indexOf(q) >= 0) ||
             (p.brand && p.brand.toLowerCase().indexOf(q) >= 0);
    });
    listEl.innerHTML = products.map(function (p) {
      return '<button type="button" class="trade-catalog-item w-full flex items-center gap-2 p-2 rounded-lg border border-white/10 hover:border-fi-accent/50 hover:bg-white/5 text-left transition-colors" data-product-id="' + p.id + '">' +
        '<img src="' + p.imageURL + '" alt="" class="w-10 h-10 rounded object-cover bg-gray-800 flex-shrink-0" onerror="this.style.display=\'none\'">' +
        '<div class="min-w-0 flex-1"><div class="text-white text-sm font-medium truncate">' + p.name + '</div><div class="text-gray-500 text-xs">' + p.price.toLocaleString() + ' CR</div></div>' +
        '</button>';
    }).join('');
  }

  function renderYourOffer() {
    var offerEl = document.getElementById('trade-your-offer');
    if (!offerEl) return;
    var parts = [];
    yourOfferItems.forEach(function (p, idx) {
      parts.push('<div class="trade-offer-item flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 p-2 text-sm" data-index="' + idx + '">' +
        '<img src="' + p.imageURL + '" alt="" class="w-10 h-10 rounded object-cover flex-shrink-0" onerror="this.style.display=\'none\'">' +
        '<span class="text-white truncate flex-1 min-w-0">' + p.name + '</span>' +
        '<button type="button" class="trade-remove-item text-red-400 hover:text-red-300 text-xs font-bold" data-index="' + idx + '" aria-label="Remove">×</button></div>');
    });
    if (yourOfferCredits > 0) {
      parts.push('<div class="trade-offer-credits flex items-center gap-2 rounded-lg border border-fi-success/40 bg-fi-success/10 px-2 py-1.5 text-sm">' +
        '<span class="text-gray-400">Credits:</span><span class="text-fi-success font-mono font-bold">' + yourOfferCredits.toLocaleString() + ' CR</span>' +
        '<button type="button" class="trade-remove-credits text-red-400 hover:text-red-300 text-xs font-bold ml-1" aria-label="Remove credits">×</button></div>');
    }
    if (parts.length === 0) {
      offerEl.innerHTML = '<span class="text-gray-500 text-sm">Add items from catalog or add credits</span>';
    } else {
      offerEl.innerHTML = parts.join('');
      offerEl.querySelectorAll('.trade-remove-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var i = parseInt(btn.getAttribute('data-index'), 10);
          yourOfferItems.splice(i, 1);
          renderYourOffer();
        });
      });
      offerEl.querySelectorAll('.trade-remove-credits').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          yourOfferCredits = 0;
          renderYourOffer();
        });
      });
    }
  }

  function openTradeModal(productOrNull) {
    if (!tradeModal) return;
    yourOfferItems = [];
    yourOfferCredits = 0;
    var balEl = document.getElementById('trade-your-balance');
    if (balEl) balEl.textContent = balance.toLocaleString();
    var searchInput = document.getElementById('trade-catalog-search');
    if (searchInput) searchInput.value = '';
    renderTradeCatalog('');
    renderYourOffer();

    if (productOrNull) {
      if (tradePartnerLabel) tradePartnerLabel.textContent = 'Trade for: ' + productOrNull.name;
      var theirSide = document.getElementById('trade-their-offer');
      if (theirSide) {
        theirSide.innerHTML = '<div class="rounded-lg border border-white/10 p-3 bg-white/5 text-center">' +
          '<img src="' + productOrNull.imageURL + '" alt="" class="w-16 h-16 mx-auto object-contain rounded" onerror="this.style.display=\'none\'">' +
          '<div class="text-white text-sm font-medium mt-1">' + productOrNull.name + '</div>' +
          '<div class="text-fi-success text-xs">' + productOrNull.price.toLocaleString() + ' CR</div></div>';
      }
    } else {
      if (tradePartnerLabel) tradePartnerLabel.textContent = 'New trade – add items from catalog or credits';
      var theirSideEl = document.getElementById('trade-their-offer');
      if (theirSideEl) theirSideEl.innerHTML = '<p class="text-gray-500 text-sm">Select a product on the dashboard and click Trade to set their offer.</p>';
    }

    tradeModal.classList.remove('hidden');
    if (tradeModal.setAttribute) tradeModal.setAttribute('aria-hidden', 'false');
  }

  function closeTradeModal() {
    if (tradeModal) {
      tradeModal.classList.add('hidden');
      tradeModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (tradeModalClose) tradeModalClose.addEventListener('click', closeTradeModal);
  if (tradeModalBackdrop) tradeModalBackdrop.addEventListener('click', closeTradeModal);

  document.getElementById('trade-catalog-list').addEventListener('click', function (e) {
    var btn = e.target.closest('.trade-catalog-item');
    if (!btn) return;
    var id = btn.getAttribute('data-product-id');
    var p = window.products && window.products.find(function (x) { return x.id === id; });
    if (p) {
      yourOfferItems.push(p);
      renderYourOffer();
    }
  });

  var catalogSearch = document.getElementById('trade-catalog-search');
  if (catalogSearch) {
    catalogSearch.addEventListener('input', function () {
      renderTradeCatalog(catalogSearch.value);
    });
  }

  var tradeAddCreditsBtn = document.getElementById('trade-add-credits-btn');
  var tradeCreditsInput = document.getElementById('trade-credits-input');
  if (tradeAddCreditsBtn && tradeCreditsInput) {
    tradeAddCreditsBtn.addEventListener('click', function () {
      var val = parseInt(tradeCreditsInput.value, 10);
      if (isNaN(val) || val <= 0) return;
      var max = balance;
      yourOfferCredits = Math.min((yourOfferCredits || 0) + val, max);
      if (yourOfferCredits > max) yourOfferCredits = max;
      tradeCreditsInput.value = '';
      renderYourOffer();
    });
  }

  var tradeCancelBtn = document.getElementById('trade-cancel-btn');
  var tradeSendBtn = document.getElementById('trade-send-btn');
  var TRADE_FEE_PCT = 0.05;
  var TRADE_FEE_MIN_CR = 50;
  if (tradeCancelBtn) tradeCancelBtn.addEventListener('click', closeTradeModal);
  if (tradeSendBtn) tradeSendBtn.addEventListener('click', function () {
    var total = yourOfferItems.length + (yourOfferCredits > 0 ? 1 : 0);
    if (total === 0) {
      alert('Add at least one item or credits to your offer before sending.');
      return;
    }
    var offerValue = yourOfferItems.reduce(function (sum, p) { return sum + (Number(p.price) || 0); }, 0) + (yourOfferCredits || 0);
    var fee = Math.max(TRADE_FEE_MIN_CR, Math.ceil(offerValue * TRADE_FEE_PCT));
    var required = fee + (yourOfferCredits || 0);
    if (balance < required) {
      alert('Insufficient balance. You need ' + required.toLocaleString() + ' CR (fee ' + fee.toLocaleString() + ' CR' + (yourOfferCredits ? ' + ' + yourOfferCredits.toLocaleString() + ' CR offered' : '') + '). You have ' + balance.toLocaleString() + ' CR.');
      return;
    }
    document.dispatchEvent(new CustomEvent('balance-deduct', { detail: { amount: fee } }));
    var firstItem = yourOfferItems.length ? yourOfferItems[0] : null;
    if (typeof startActiveTrade === 'function') startActiveTrade({ name: firstItem ? firstItem.name : 'Trade offer', id: firstItem ? firstItem.id : '' });
    alert('Trade offer sent! ' + fee + ' CR fee applied. The other party can accept or counter in My Trades.');
    closeTradeModal();
  });

  function updateTradeBalance() {
    var el = document.getElementById('trade-your-balance');
    if (el) el.textContent = balance.toLocaleString();
  }
  document.addEventListener('DOMContentLoaded', updateTradeBalance);
  if (tradeModal) tradeModal.addEventListener('transitionend', updateTradeBalance);

  // ---------------------------------------------------------------------------
  // Get Verified modal
  // ---------------------------------------------------------------------------
  var verifyModal = document.getElementById('verify-modal');
  var verifyModalClose = document.getElementById('verify-modal-close');
  var verifyModalBackdrop = document.getElementById('verify-modal-backdrop');

  function openVerifyModal() {
    if (verifyModal) {
      verifyModal.classList.remove('hidden');
      verifyModal.setAttribute('aria-hidden', 'false');
      if (typeof window.resetVerifyWizard === 'function') window.resetVerifyWizard();
    }
  }

  function closeVerifyModal() {
    if (verifyModal) {
      verifyModal.classList.add('hidden');
      verifyModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (verifyModalClose) verifyModalClose.addEventListener('click', closeVerifyModal);
  if (verifyModalBackdrop) verifyModalBackdrop.addEventListener('click', closeVerifyModal);

  // ---------------------------------------------------------------------------
  // Product detail popover (TradingView-style chart)
  // ---------------------------------------------------------------------------
  var productDetailPopover = document.getElementById('product-detail-popover');
  var productDetailBackdrop = document.getElementById('product-detail-backdrop');
  var productDetailClose = document.getElementById('product-detail-close');
  var currentDetailProduct = null;
  var currentChartRange = 14;

  function renderTradingViewChart(container, yAxisEl, xAxisEl, priceHistory, rangeDays, gradientId, priceLow, priceHigh) {
    if (!container || !priceHistory || !priceHistory.length) return;
    var data = rangeDays ? priceHistory.slice(-rangeDays) : priceHistory;
    if (!data.length) return;
    var gradId = gradientId || 'chartGradient';

    var values = data.map(function (d) { return d.value; });
    var dataMin = Math.min.apply(null, values);
    var dataMax = Math.max.apply(null, values);
    var yMin, yMax, showRangeBand = false;
    if (typeof priceLow === 'number' && typeof priceHigh === 'number' && priceHigh > priceLow) {
      yMin = priceLow;
      yMax = priceHigh;
      showRangeBand = true;
    } else {
      var range = dataMax - dataMin || 1;
      var padding = range * 0.05;
      yMin = dataMin - padding;
      yMax = dataMax + padding;
    }
    var yRange = yMax - yMin || 1;

    var w = 520;
    var h = 220;
    var padLeft = 0;
    var padRight = 0;
    var padTop = 8;
    var padBottom = 8;
    var chartW = w - padLeft - padRight;
    var chartH = h - padTop - padBottom;

    function yToPx(val) {
      return padTop + chartH - ((val - yMin) / yRange) * chartH;
    }

    var points = data.map(function (d, i) {
      var div = data.length > 1 ? data.length - 1 : 1;
      var x = padLeft + (i / div) * chartW;
      var y = yToPx(d.value);
      return x + ',' + y;
    });
    var linePath = 'M' + points.join(' L');
    var areaPath = 'M' + padLeft + ',' + (padTop + chartH) + ' L' + points.join(' L') + ' L' + (padLeft + chartW) + ',' + (padTop + chartH) + ' Z';

    var gridLines = [];
    for (var g = 0; g <= 4; g++) {
      var gy = padTop + (g / 4) * chartH;
      gridLines.push('<line x1="' + padLeft + '" y1="' + gy + '" x2="' + (padLeft + chartW) + '" y2="' + gy + '" class="chart-grid-line"/>');
    }
    for (var gx = 0; gx <= 4; gx++) {
      var gxVal = padLeft + (gx / 4) * chartW;
      gridLines.push('<line x1="' + gxVal + '" y1="' + padTop + '" x2="' + gxVal + '" y2="' + (padTop + chartH) + '" class="chart-grid-line"/>');
    }

    var rangeBandRect = '';
    if (showRangeBand && priceLow < priceHigh) {
      var bandY = yToPx(priceHigh);
      var bandH = yToPx(priceLow) - bandY;
      rangeBandRect = '<rect x="' + padLeft + '" y="' + bandY + '" width="' + chartW + '" height="' + bandH + '" class="chart-range-band" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.25)" stroke-width="0.5"/>';
    }

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" class="chart-svg">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="rgba(88,166,255,0.15)"/><stop offset="100%" stop-color="rgba(88,166,255,0)"/></linearGradient></defs>' +
      '<g class="chart-grid">' + gridLines.join('') + '</g>' +
      rangeBandRect +
      '<path d="' + areaPath + '" fill="url(#' + gradId + ')" class="chart-area"/>' +
      '<path d="' + linePath + '" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chart-line"/>' +
      '</svg>';
    container.innerHTML = svg;

    var cur = window.currentCurrency || 'USD';
    var rate = cur === 'ILS' ? (window.usdToIlsRate || 1) : 1;
    var sym = cur === 'ILS' ? '₪' : '$';
    var yStep = (yMax - yMin) / 4;
    var yLabels = [];
    for (var yi = 4; yi >= 0; yi--) {
      var val = Math.round((yMin + yi * yStep) * rate);
      yLabels.push('<span>' + sym + val + '</span>');
    }
    if (yAxisEl) yAxisEl.innerHTML = yLabels.join('');

    if (xAxisEl && data.length) {
      var first = data[0].date;
      var last = data[data.length - 1].date;
      var format = function (s) { return s ? s.slice(5).replace(/-/g, '/') : ''; };
      xAxisEl.innerHTML = '<span>' + format(first) + '</span><span>' + format(last) + '</span>';
    }
  }

  function openProductDetailPopover(p) {
    currentDetailProduct = p;
    currentChartRange = 14;
    if (!productDetailPopover || !p) return;

    document.getElementById('product-detail-thumb').src = p.imageURL;
    document.getElementById('product-detail-thumb').alt = p.name;
    document.getElementById('product-detail-name').textContent = p.name;
    document.getElementById('product-detail-brand').textContent = p.brand;
    var rangeCR = formatPriceRangeCR(p.priceLow, p.priceHigh);
    document.getElementById('product-detail-range').textContent = rangeCR;
    document.getElementById('product-detail-cr').textContent = p.price.toLocaleString() + ' CR';

    var chartEl = document.getElementById('product-detail-chart');
    var yAxisEl = document.getElementById('product-detail-yaxis');
    var xAxisEl = document.getElementById('product-detail-xaxis');
    renderTradingViewChart(chartEl, yAxisEl, xAxisEl, p.priceHistory, currentChartRange, undefined, p.priceLow, p.priceHigh);

    productDetailPopover.classList.remove('hidden');
    productDetailPopover.classList.add('active');
    productDetailPopover.setAttribute('aria-hidden', 'false');

    document.querySelectorAll('.product-detail-tab').forEach(function (tab) {
      tab.classList.toggle('active', parseInt(tab.getAttribute('data-range'), 10) === currentChartRange);
    });
  }

  function closeProductDetailPopover() {
    if (productDetailPopover) {
      productDetailPopover.classList.add('hidden');
      productDetailPopover.classList.remove('active');
      productDetailPopover.setAttribute('aria-hidden', 'true');
    }
    currentDetailProduct = null;
  }

  if (productDetailClose) productDetailClose.addEventListener('click', closeProductDetailPopover);
  if (productDetailBackdrop) productDetailBackdrop.addEventListener('click', closeProductDetailPopover);

  // ---------------------------------------------------------------------------
  // Price list: View Details hovering card (photo, range, graph, variations)
  // ---------------------------------------------------------------------------
  var priceListDetailWrap = document.getElementById('price-list-detail-card-wrap');
  var priceListDetailCard = document.getElementById('price-list-detail-card');
  var priceListDetailBackdrop = document.getElementById('price-list-detail-backdrop');
  var priceListDetailClose = document.getElementById('price-list-detail-close');
  var priceListDetailVariationSelect = document.getElementById('price-list-detail-variation');
  var priceListDetailVariationWrap = document.getElementById('price-list-detail-variation-wrap');
  var priceListDetailCurrentProduct = null; // base product (with optional variations)
  var priceListDetailCurrentItem = null;   // currently displayed item (main or variation)

  function openPriceListDetailCard(p) {
    if (!p || !priceListDetailWrap) return;
    priceListDetailCurrentProduct = p;
    priceListDetailCurrentItem = p;
    fillPriceListDetailCard(p);

    if (p.variations && p.variations.length) {
      if (priceListDetailVariationWrap) priceListDetailVariationWrap.classList.remove('hidden');
      if (priceListDetailVariationSelect) {
        priceListDetailVariationSelect.innerHTML = '<option value="-1">Default</option>' +
          p.variations.map(function (v, i) { return '<option value="' + i + '">' + (v.name || v.id || 'Option ' + (i + 1)) + '</option>'; }).join('');
        priceListDetailVariationSelect.value = '-1';
        priceListDetailVariationSelect.onchange = function () {
          var val = priceListDetailVariationSelect.value;
          if (val === '-1') { priceListDetailCurrentItem = p; fillPriceListDetailCard(p); return; }
          var idx = parseInt(val, 10);
          if (idx >= 0 && p.variations[idx]) { priceListDetailCurrentItem = p.variations[idx]; fillPriceListDetailCard(p.variations[idx]); }
        };
      }
    } else {
      if (priceListDetailVariationWrap) priceListDetailVariationWrap.classList.add('hidden');
      if (priceListDetailVariationSelect) priceListDetailVariationSelect.onchange = null;
    }

    priceListDetailWrap.classList.remove('hidden');
    priceListDetailWrap.setAttribute('aria-hidden', 'false');
  }

  function fillPriceListDetailCard(item) {
    if (!item) return;
    var imgEl = document.getElementById('price-list-detail-img');
    var nameEl = document.getElementById('price-list-detail-name');
    var brandEl = document.getElementById('price-list-detail-brand');
    var rangeEl = document.getElementById('price-list-detail-range');
    var crEl = document.getElementById('price-list-detail-cr');
    var chartEl = document.getElementById('price-list-detail-chart');
    var yAxisEl = document.getElementById('price-list-detail-yaxis');
    var xAxisEl = document.getElementById('price-list-detail-xaxis');
    if (imgEl) { imgEl.src = item.imageURL || item.image || ''; imgEl.alt = item.name || ''; imgEl.style.display = (item.imageURL || item.image) ? '' : 'none'; }
    if (nameEl) nameEl.textContent = item.name || '';
    if (brandEl) brandEl.textContent = item.brand || '';
    if (rangeEl) {
      if (item._fromMarket && window.marketService) {
        rangeEl.textContent = formatPriceRangeCR(item.retailPrice || 0, item.resellPrice || 0);
      } else {
        rangeEl.textContent = formatPriceRangeCR(item.priceLow, item.priceHigh);
      }
    }
    var conditionWrap = document.getElementById('price-list-detail-condition-wrap');
    var conditionSelect = document.getElementById('price-list-detail-condition');
    if (item._fromMarket && window.marketService) {
      if (conditionWrap) conditionWrap.classList.remove('hidden');
      if (conditionSelect) conditionSelect.value = '0';
      var isUsed = false;
      var resellCR = Math.round((item.resellPrice || 0) * USD_TO_CR);
      if (crEl) crEl.textContent = resellCR.toLocaleString() + ' CR';
      if (conditionSelect) {
        conditionSelect.onchange = function () {
          var used = conditionSelect.value === '1';
          if (crEl && priceListDetailCurrentItem && priceListDetailCurrentItem._fromMarket && window.marketService) {
            var r = (priceListDetailCurrentItem.resellPrice || 0) * USD_TO_CR;
            crEl.textContent = Math.round(r).toLocaleString() + ' CR';
          }
        };
      }
    } else {
      if (conditionWrap) conditionWrap.classList.add('hidden');
      if (crEl) crEl.textContent = (item.price != null ? Number(item.price).toLocaleString() : '') + ' CR';
    }
    var hist = item.priceHistory || [];
    if (chartEl && hist.length) {
      renderTradingViewChart(chartEl, yAxisEl, xAxisEl, hist, 14, 'chartGradientPriceList', item.priceLow, item.priceHigh);
    } else {
      if (chartEl) chartEl.innerHTML = '';
      if (yAxisEl) yAxisEl.innerHTML = '';
      if (xAxisEl) xAxisEl.innerHTML = '';
    }
  }

  function closePriceListDetailCard() {
    if (priceListDetailWrap) {
      priceListDetailWrap.classList.add('hidden');
      priceListDetailWrap.setAttribute('aria-hidden', 'true');
    }
    priceListDetailCurrentProduct = null;
    priceListDetailCurrentItem = null;
  }

  if (priceListDetailBackdrop) priceListDetailBackdrop.addEventListener('click', closePriceListDetailCard);
  if (priceListDetailClose) priceListDetailClose.addEventListener('click', closePriceListDetailCard);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && priceListDetailWrap && !priceListDetailWrap.classList.contains('hidden')) closePriceListDetailCard();
  });

  document.querySelectorAll('.product-detail-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      currentChartRange = parseInt(tab.getAttribute('data-range'), 10);
      document.querySelectorAll('.product-detail-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      if (currentDetailProduct) {
        var chartEl = document.getElementById('product-detail-chart');
        var yAxisEl = document.getElementById('product-detail-yaxis');
        var xAxisEl = document.getElementById('product-detail-xaxis');
        renderTradingViewChart(chartEl, yAxisEl, xAxisEl, currentDetailProduct.priceHistory, currentChartRange, undefined, currentDetailProduct.priceLow, currentDetailProduct.priceHigh);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Event delegation: sneaker grid (image click -> popover, heart, Trade, BUY)
  // ---------------------------------------------------------------------------
  document.getElementById('sneaker-grid').addEventListener('click', function (e) {
    var card = e.target.closest('.product-card');
    if (!card) return;
    var id = card.getAttribute('data-product-id');
    var p = window.products && window.products.find(function (x) { return x.id === id; });
    if (!p) return;

    if (e.target.closest('.product-card-img-wrap') && !e.target.closest('.btn-heart')) {
      openProductDetailPopover(p);
      return;
    }
    if (e.target.closest('.btn-heart')) {
      likedIds[p.id] = !likedIds[p.id];
      var heart = card.querySelector('.btn-heart');
      if (heart) heart.classList.toggle('text-red-500', likedIds[p.id]), heart.classList.toggle('text-gray-400', !likedIds[p.id]);
      return;
    }
    if (e.target.closest('.btn-trade')) {
      openTradeModal(p);
      return;
    }
    if (e.target.closest('.btn-buy')) {
      var itemPrice = p.price;
      var isPro = localStorage.getItem('userPlan') === 'PRO';
      var feePct = isPro ? 2 : 5;
      var feeAmount = Math.round(itemPrice * (feePct / 100));
      var total = itemPrice + feeAmount;
      if (balance < total) {
        alert('Not enough balance. You need ' + total.toLocaleString() + ' CR (item + ' + feePct + '% buyer protection). You have ' + balance.toLocaleString() + ' CR.');
        return;
      }
      pendingBuyProduct = p;
      document.dispatchEvent(new CustomEvent('show-buy-modal', {
        detail: {
          productName: p.name,
          itemPrice: itemPrice,
          feePct: feePct,
          feeAmount: feeAmount,
          total: total
        }
      }));
      return;
    }
  });

  // ---------------------------------------------------------------------------
  // Active Trade Status (Amazon-style tracking, localStorage + 5s step advance)
  // ---------------------------------------------------------------------------
  var ACTIVE_TRADE_KEY = 'fashion_insider_active_trade';
  var activeTradeTimeoutId = null;

  function getActiveTrade() {
    try {
      var raw = localStorage.getItem(ACTIVE_TRADE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setActiveTrade(obj) {
    try { localStorage.setItem(ACTIVE_TRADE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function clearActiveTrade() {
    try { localStorage.removeItem(ACTIVE_TRADE_KEY); } catch (e) {}
    if (activeTradeTimeoutId) clearTimeout(activeTradeTimeoutId);
    activeTradeTimeoutId = null;
    var wrap = document.getElementById('active-trade-status');
    if (wrap) wrap.classList.add('hidden');
  }

  function renderActiveTradeStepper(step) {
    var stepNum = Math.max(1, Math.min(4, step));
    document.querySelectorAll('.trade-step').forEach(function (el) {
      var n = parseInt(el.getAttribute('data-step'), 10);
      el.classList.remove('active', 'completed');
      if (n < stepNum) el.classList.add('completed');
      else if (n === stepNum) el.classList.add('active');
    });
    document.querySelectorAll('.trade-step-line').forEach(function (el) {
      var after = parseInt(el.getAttribute('data-after'), 10);
      el.classList.toggle('filled', after < stepNum);
    });
    var completedMsg = document.getElementById('active-trade-completed-msg');
    if (completedMsg) completedMsg.classList.toggle('hidden', stepNum < 4);
    var safeZonesWrap = document.getElementById('active-trade-safe-zones-wrap');
    if (safeZonesWrap) safeZonesWrap.classList.toggle('hidden', stepNum < 2 || stepNum >= 4);
  }

  function advanceActiveTradeStep() {
    activeTradeTimeoutId = null;
    var t = getActiveTrade();
    if (!t || t.step >= 4) return;
    t.step = (t.step || 1) + 1;
    setActiveTrade(t);
    renderActiveTradeStepper(t.step);
    if (t.step >= 4) {
      showConfetti();
      return;
    }
    activeTradeTimeoutId = setTimeout(advanceActiveTradeStep, 5000);
  }

  function showConfetti() {
    var container = document.getElementById('confetti-container');
    if (!container) return;
    container.innerHTML = '';
    var colors = ['#58a6ff', '#2ea043', '#f85149', '#d29922', '#a371f7'];
    for (var i = 0; i < 50; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.5 + 's';
      piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      container.appendChild(piece);
    }
    setTimeout(function () { container.innerHTML = ''; }, 4000);
  }
  window.showConfetti = showConfetti;

  function startActiveTrade(product) {
    var t = { step: 1, productName: product.name || 'Item', productId: product.id || '', startedAt: Date.now() };
    setActiveTrade(t);
    var wrap = document.getElementById('active-trade-status');
    var nameEl = document.getElementById('active-trade-product-name');
    var completedMsg = document.getElementById('active-trade-completed-msg');
    var safeZonesWrap = document.getElementById('active-trade-safe-zones-wrap');
    if (wrap) wrap.classList.remove('hidden');
    if (nameEl) nameEl.textContent = 'Tracking: ' + t.productName;
    if (completedMsg) completedMsg.classList.add('hidden');
    if (safeZonesWrap) safeZonesWrap.classList.add('hidden');
    renderActiveTradeStepper(1);
    if (activeTradeTimeoutId) clearTimeout(activeTradeTimeoutId);
    activeTradeTimeoutId = setTimeout(advanceActiveTradeStep, 5000);
  }

  (function initActiveTrade() {
    var t = getActiveTrade();
    if (!t) return;
    var wrap = document.getElementById('active-trade-status');
    var nameEl = document.getElementById('active-trade-product-name');
    if (wrap) wrap.classList.remove('hidden');
    if (nameEl) nameEl.textContent = 'Tracking: ' + (t.productName || 'Trade');
    renderActiveTradeStepper(t.step || 1);
    if (t.step < 4) {
      if (activeTradeTimeoutId) clearTimeout(activeTradeTimeoutId);
      activeTradeTimeoutId = setTimeout(advanceActiveTradeStep, 5000);
    }
  })();

  var dismissBtn = document.getElementById('active-trade-dismiss');
  if (dismissBtn) dismissBtn.addEventListener('click', function () { clearActiveTrade(); });

  // ---------------------------------------------------------------------------
  // Header: Start Trade (empty trade modal), Get Verified
  // ---------------------------------------------------------------------------
  var btnStartTrade = document.getElementById('btn-start-trade');
  var btnGetVerified = document.getElementById('btn-get-verified');
  if (btnStartTrade) btnStartTrade.addEventListener('click', function () { openTradeModal(null); });
  if (btnGetVerified) btnGetVerified.addEventListener('click', openVerifyModal);

  // ---------------------------------------------------------------------------
  // Community: "I'm Interested" on posts
  // ---------------------------------------------------------------------------
  document.querySelectorAll('#community-section button').forEach(function (btn) {
    if (btn.textContent.trim() === "I'm Interested") {
      btn.addEventListener('click', function () {
        var post = btn.closest('.bg-card');
        var author = post ? post.querySelector('.font-semibold.text-white') : null;
        alert('Interest sent to ' + (author ? author.textContent : 'seller') + '. They can message you in Messages.');
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Trades section: Accept / Counter / Decline
  // ---------------------------------------------------------------------------
  document.querySelectorAll('#trades-section button').forEach(function (btn) {
    var t = btn.textContent.trim();
    if (t === 'Accept Offer') {
      btn.addEventListener('click', function () {
        if (balance < TRADE_FEE_CR) {
          alert('You need at least ' + TRADE_FEE_CR + ' CR to confirm this trade (service fee). Top up and try again.');
          return;
        }
        document.dispatchEvent(new CustomEvent('balance-deduct', { detail: { amount: TRADE_FEE_CR } }));
        alert('Offer accepted! ' + TRADE_FEE_CR + ' CR service fee applied. Complete the trade in Messages.');
      });
    } else if (t === 'Counter Offer') {
      btn.addEventListener('click', function () { alert('Counter-offer screen would open here (mock).'); });
    } else if (t === 'Decline') {
      btn.addEventListener('click', function () {
        var card = btn.closest('.bg-white\\/5');
        if (card) card.style.opacity = '0.5';
        alert('Offer declined.');
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Messages: Smart Message Filter (block contact/leakage) + send
  // ---------------------------------------------------------------------------
  var msgInput = document.querySelector('#messages-section input[placeholder*="Message"]');
  var msgSend = document.getElementById('messages-send-btn') || document.querySelector('#messages-section button[type="button"]');
  var chatToast = document.getElementById('chat-toast');

  var CHAT_BANNED_PATTERNS = [
    /\b05\d-?\d{7}\b/,                    // Israeli mobile
    /\d{3}-\d{3}-\d{4}/,                  // US-style phone
    /\b\d{9,11}\b/,                       // Generic 9–11 digit number (phone)
    /@/,                                  // Email (contains @)
    /\bwhatsapp\b/i,
    /\binsta\b/i,
    /\binstagram\b/i,
    /\bphone\b/i,
    /\bcall\s+me\b/i,
    /\bnumber\b/i,
    /\bemail\b/i,
    /\bgmail\b/i,
    /\bpaybox\b/i,
    /\bbit\b/i
  ];

  var CHAT_WARNING_MSG = '⚠️ Warning: Sharing contact details is not allowed before purchase. Keep deals inside for protection.';

  function chatContainsBannedPattern(text) {
    if (!text) return false;
    for (var i = 0; i < CHAT_BANNED_PATTERNS.length; i++) {
      if (CHAT_BANNED_PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  function showChatToast(message) {
    if (!chatToast) return;
    chatToast.textContent = message;
    chatToast.classList.remove('hidden');
    chatToast.style.display = '';
    clearTimeout(showChatToast._tid);
    showChatToast._tid = setTimeout(function () {
      chatToast.classList.add('hidden');
    }, 5000);
  }

  function shakeMessageInput() {
    if (!msgInput) return;
    msgInput.classList.remove('shake');
    msgInput.offsetHeight;
    msgInput.classList.add('shake');
    setTimeout(function () { msgInput.classList.remove('shake'); }, 500);
  }

  var messagesListEl = document.getElementById('messages-list');
  var newMessageToast = document.getElementById('new-message-toast');
  var currentUserId = null;
  var currentChannelId = 'general';

  function displayNameForSender(senderId, isOwn) {
    if (isOwn) return 'You';
    if (!senderId) return 'User';
    var s = String(senderId);
    return s.length > 8 ? s.slice(0, 8) + '…' : s;
  }

  function appendMessageToUI(msg, isOwn) {
    if (!messagesListEl) return;
    var time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    var name = displayNameForSender(msg.sender_id, isOwn);
    var initials = isOwn ? 'Y' : (name.slice(0, 1).toUpperCase() || 'U');
    var div = document.createElement('div');
    div.className = 'flex gap-3';
    div.innerHTML = '<div class="w-8 h-8 rounded-full bg-fi-accent flex items-center justify-center text-white text-xs font-bold shrink-0">' + initials + '</div><div><span class="font-semibold text-white">' + name + '</span><span class="text-gray-500 text-xs ml-2">' + time + '</span><p class="text-gray-300 text-sm mt-0.5">' + (msg.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p></div>';
    messagesListEl.appendChild(div);
    messagesListEl.scrollTop = messagesListEl.scrollHeight;
  }

  function isOnMessagesSection() {
    var el = document.getElementById('messages-section');
    return el && !el.classList.contains('hidden');
  }

  function isMessageInCurrentChannel(msg) {
    return msg.channel_id === currentChannelId;
  }

  if (window.FashionInsiderSupabase && window.FashionInsiderSupabase.isSupabaseEnabled()) {
    window.FashionInsiderSupabase.setCurrentChannelId(currentChannelId);
    window.FashionInsiderSupabase.getAuthUserId().then(function (uid) {
      currentUserId = uid || localStorage.getItem('supabase_user_id') || null;
      if (!currentUserId) console.warn('[Messages] No auth user; set supabase_user_id in localStorage or sign in.');
      else console.log('[Messages] Using sender_id:', currentUserId);
      window.FashionInsiderSupabase.subscribeToMessages(currentUserId, function (msg) {
        if (!isMessageInCurrentChannel(msg)) return;
        var isOwn = msg.sender_id === currentUserId;
        appendMessageToUI(msg, isOwn);
        if (!isOnMessagesSection()) {
          if (newMessageToast) {
            newMessageToast.classList.remove('hidden');
            newMessageToast.style.display = '';
            clearTimeout(newMessageToast._tid);
            newMessageToast._tid = setTimeout(function () { newMessageToast.classList.add('hidden'); }, 5000);
          }
        }
      });
    });
    var supabase = window.FashionInsiderSupabase.getSupabase();
    if (supabase && supabase.from('messages').select && messagesListEl) {
      var fetchMessages = function () {
        if (!currentUserId) {
          messagesListEl.innerHTML = '<p class="text-gray-500 text-sm p-4">Sign in or set <code>supabase_user_id</code> to load messages.</p>';
          return;
        }
        supabase.from('messages').select('sender_id,channel_id,content').eq('channel_id', currentChannelId).then(function (r) {
          console.log('[Messages] Fetch response:', r.data, 'error:', r.error);
          if (r.error) console.error('[Messages] Fetch error:', r.error);
          if (r.data && messagesListEl) {
            messagesListEl.innerHTML = '';
            r.data.forEach(function (row) {
              appendMessageToUI({ sender_id: row.sender_id, channel_id: row.channel_id, content: row.content }, row.sender_id === currentUserId);
            });
          }
        });
      };
      window.FashionInsiderSupabase.getAuthUserId().then(function (uid) {
        currentUserId = uid || localStorage.getItem('supabase_user_id') || null;
        fetchMessages();
      });
      window.fashionInsiderFetchMessages = fetchMessages;
    }
  }

  if (newMessageToast) {
    newMessageToast.addEventListener('click', function () {
      newMessageToast.classList.add('hidden');
      var btn = document.querySelector('.header-nav[data-section="messages-section"]');
      if (btn) btn.click();
    });
  }

  function sendMessage() {
    if (!msgInput) return;
    var content = msgInput.value.trim();
    if (!content) return;

    if (chatContainsBannedPattern(content)) {
      shakeMessageInput();
      showChatToast(CHAT_WARNING_MSG);
      msgInput.value = '';
      msgInput.focus();
      return;
    }

    if (window.FashionInsiderSupabase && window.FashionInsiderSupabase.isSupabaseEnabled()) {
      window.FashionInsiderSupabase.getAuthUserId().then(function (uid) {
        var senderId = uid || currentUserId || localStorage.getItem('supabase_user_id') || null;
        if (!senderId) {
          showChatToast('Sign in to send messages.');
          return;
        }
        var channelId = 'general';
        doInsert(senderId, channelId, content);
      });
    } else {
      appendMessageToUI({ sender_id: currentUserId, channel_id: 'general', content: content }, true);
      msgInput.value = '';
    }
  }

  function doInsert(senderId, channelId, content) {
    window.FashionInsiderSupabase.insertMessage(senderId, channelId, content).then(function (res) {
      msgInput.value = '';
      msgInput.focus();
    }).catch(function (err) {
      console.error('[Messages] Insert error:', err);
      appendMessageToUI({ sender_id: senderId, channel_id: channelId, content: content }, true);
      msgInput.value = '';
    });
  }

  if (msgInput && msgSend) {
    msgSend.addEventListener('click', sendMessage);
    msgInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Party sidebar (Xbox-style): START PARTY + Party Members with profile pics
  // ---------------------------------------------------------------------------
  var partyStartBtn = document.getElementById('party-start-btn');
  var partyMembersList = document.getElementById('party-members-list');
  var partyActive = false;
  var PARTY_MEMBERS_MOCK = [
    { name: 'SneakerKing', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SK' },
    { name: 'FashionPro', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=FP' },
    { name: 'HypeTrader', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HT' }
  ];

  function renderPartyMembers() {
    if (!partyMembersList) return;
    if (!partyActive) {
      partyMembersList.innerHTML = '<div class="party-member flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Party1" alt="" class="w-10 h-10 rounded-full object-cover border-2 border-fi-accent flex-shrink-0" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" /><div class="w-10 h-10 rounded-full bg-fi-accent/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hidden">P</div><div class="min-w-0 flex-1"><div class="text-white text-sm font-medium truncate">No party yet</div><div class="text-gray-500 text-xs">Click Start Party to invite friends</div></div></div>';
      return;
    }
    partyMembersList.innerHTML = PARTY_MEMBERS_MOCK.map(function (m) {
      var initials = (m.name || 'U').slice(0, 2).toUpperCase();
      return '<div class="party-member flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"><img src="' + (m.avatar || '') + '" alt="" class="w-10 h-10 rounded-full object-cover border-2 border-fi-accent flex-shrink-0" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" /><div class="w-10 h-10 rounded-full bg-fi-accent/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hidden">' + initials + '</div><div class="min-w-0 flex-1"><div class="text-white text-sm font-medium truncate">' + (m.name || 'Member') + '</div><div class="text-gray-500 text-xs">In party</div></div></div>';
    }).join('');
  }

  if (partyStartBtn) {
    partyStartBtn.addEventListener('click', function () {
      partyActive = !partyActive;
      if (partyActive) {
        partyStartBtn.innerHTML = '<span class="party-start-icon">■</span> Leave Party';
        partyStartBtn.classList.add('opacity-90');
      } else {
        partyStartBtn.innerHTML = '<span class="party-start-icon">▶</span> Start Party';
        partyStartBtn.classList.remove('opacity-90');
      }
      renderPartyMembers();
    });
  }
  renderPartyMembers();

  // ---------------------------------------------------------------------------
  // Community post input "+" and "What are you looking for?"
  // ---------------------------------------------------------------------------
  var communityInput = document.querySelector('#community-section input[placeholder*="looking for"]');
  var communityPlus = document.querySelector('#community-section .rounded-full.bg-fi-accent');
  if (communityInput && communityPlus) {
    communityPlus.addEventListener('click', function () {
      var q = communityInput.value.trim();
      alert(q ? 'Post created: "' + q + '"' : 'Type what you\'re looking for and click + to post.');
    });
  }

  // ---------------------------------------------------------------------------
  // Safe Zones: real places via OpenStreetMap Nominatim (police + mall near user)
  // ---------------------------------------------------------------------------
  var NOMINATIM_UA = 'FashionInsiderApp/1.0 (safe meeting points)';

  function getCityFromStorage() {
    var city = localStorage.getItem('userCity');
    if (city && city.trim()) return city.trim();
    try {
      var ps = localStorage.getItem('profileSettings');
      if (ps) {
        var o = JSON.parse(ps);
        if (o && o.city && o.city.trim()) return o.city.trim();
      }
    } catch (e) {}
    city = localStorage.getItem('ps-city');
    if (city && city.trim()) return city.trim();
    return null;
  }

  function getSavedCoords() {
    var lat = localStorage.getItem('userLat');
    var lon = localStorage.getItem('userLon');
    if (lat != null && lon != null) {
      var la = parseFloat(lat, 10);
      var lo = parseFloat(lon, 10);
      if (!isNaN(la) && !isNaN(lo)) return { lat: la, lon: lo };
    }
    return null;
  }

  function getLocationAsync() {
    return new Promise(function (resolve) {
      var coords = getSavedCoords();
      var city = getCityFromStorage();
      if (coords) {
        resolve({ lat: coords.lat, lon: coords.lon, city: city || 'Your location', source: 'coords' });
        return;
      }
      if (city) {
        resolve({ city: city, source: 'storage' });
        return;
      }
      if (!navigator.geolocation) {
        resolve({ city: 'Tel Aviv', source: 'fallback' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json', {
            headers: { 'Accept': 'application/json', 'User-Agent': NOMINATIM_UA }
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              var cityName = (data.address && (data.address.city || data.address.town || data.address.village || data.address.municipality)) || data.name || 'Tel Aviv';
              resolve({ city: cityName, source: 'geolocation' });
            })
            .catch(function () { resolve({ city: 'Tel Aviv', source: 'fallback' }); });
        },
        function () { resolve({ city: 'Tel Aviv', source: 'fallback' }); }
      );
    });
  }

  function fetchNominatim(query, city) {
    var q = query + ' near ' + encodeURIComponent(city);
    var url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=3';
    return fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': NOMINATIM_UA } })
      .then(function (r) { return r.json(); })
      .then(function (arr) { return Array.isArray(arr) ? arr : []; });
  }

  function fetchNominatimByViewbox(query, lat, lon) {
    var delta = 0.05;
    var minlon = lon - delta;
    var minlat = lat - delta;
    var maxlon = lon + delta;
    var maxlat = lat + delta;
    var viewbox = minlon + ',' + minlat + ',' + maxlon + ',' + maxlat;
    var url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&viewbox=' + viewbox + '&bounded=1&format=json&limit=3';
    return fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': NOMINATIM_UA } })
      .then(function (r) { return r.json(); })
      .then(function (arr) { return Array.isArray(arr) ? arr : []; });
  }

  function fetchSafePlaces(loc) {
    function mapPlace(r, type) {
      return { type: type, name: r.name || r.display_name, display_name: r.display_name, lat: r.lat, lon: r.lon };
    }
    if (loc.lat != null && loc.lon != null) {
      return Promise.all([
        fetchNominatimByViewbox('police station', loc.lat, loc.lon).then(function (arr) { return arr.map(function (r) { return mapPlace(r, 'police'); }); }),
        fetchNominatimByViewbox('shopping mall', loc.lat, loc.lon).then(function (arr) { return arr.map(function (r) { return mapPlace(r, 'mall'); }); })
      ]).then(function (results) {
        var police = results[0].slice(0, 3);
        var mall = results[1].slice(0, 3);
        return police.concat(mall);
      });
    }
    var city = loc.city || 'Tel Aviv';
    return Promise.all([
      fetchNominatim('police station', city).then(function (arr) { return arr.map(function (r) { return mapPlace(r, 'police'); }); }),
      fetchNominatim('shopping mall', city).then(function (arr) { return arr.map(function (r) { return mapPlace(r, 'mall'); }); })
    ]).then(function (results) {
      var police = results[0].slice(0, 3);
      var mall = results[1].slice(0, 3);
      return police.concat(mall);
    });
  }

  function shortAddress(displayName) {
    if (!displayName) return '';
    var parts = displayName.split(',');
    return parts.length > 2 ? parts.slice(0, 2).join(',').trim() : displayName;
  }

  var safeZonesModal = document.getElementById('safe-zones-modal');
  var safeZonesSpinner = document.getElementById('safe-zones-spinner');
  var safeZonesError = document.getElementById('safe-zones-error');
  var safeZonesList = document.getElementById('safe-zones-list');

  function openSafeZonesModal() {
    if (!safeZonesModal) return;
    safeZonesModal.classList.remove('hidden');
    safeZonesModal.setAttribute('aria-hidden', 'false');
    if (safeZonesSpinner) { safeZonesSpinner.classList.remove('hidden'); safeZonesSpinner.style.display = ''; }
    if (safeZonesError) { safeZonesError.classList.add('hidden'); safeZonesError.textContent = ''; }
    if (safeZonesList) { safeZonesList.classList.add('hidden'); safeZonesList.innerHTML = ''; }

    getLocationAsync()
      .then(function (loc) { return fetchSafePlaces(loc).then(function (places) { return { city: loc.city, places: places }; }); })
      .then(function (data) {
        if (safeZonesSpinner) safeZonesSpinner.classList.add('hidden');
        if (data.places.length === 0) {
          if (safeZonesError) {
            safeZonesError.textContent = 'No safe places found near ' + data.city + '. Try another area or use a different city in Profile & Settings.';
            safeZonesError.classList.remove('hidden');
          }
          return;
        }
        if (safeZonesList) {
          safeZonesList.classList.remove('hidden');
          safeZonesList.innerHTML = data.places.map(function (p) {
            var icon = p.type === 'police' ? '👮' : '🛍️';
            var typeLabel = p.type === 'police' ? 'Police' : 'Mall';
            var addr = shortAddress(p.display_name);
            var name = (p.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            var addrEsc = (addr || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            var msg = 'Suggested meeting point: ' + (p.name || addr) + ' — ' + addr;
            var lat = p.lat != null ? String(p.lat) : '';
            var lon = p.lon != null ? String(p.lon) : '';
            var hasCoords = lat && lon;
            var navBtns = hasCoords
              ? '<div class="safe-zone-nav-btns flex items-center gap-1 mt-2">' +
                  '<button type="button" class="btn-nav-waze safe-zone-nav-btn" title="Open in Waze" aria-label="Open in Waze" data-lat="' + lat + '" data-lon="' + lon + '"><svg class="safe-zone-nav-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></button>' +
                  '<button type="button" class="btn-nav-gmaps safe-zone-nav-btn" title="Open in Google Maps" aria-label="Open in Google Maps" data-lat="' + lat + '" data-lon="' + lon + '"><svg class="safe-zone-nav-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></button>' +
                '</div>'
              : '';
            return '<div class="rounded-lg border border-white/10 p-3 bg-white/5">' +
              '<div class="flex items-center gap-2 mb-1"><span class="text-lg">' + icon + '</span><span class="font-semibold text-white">' + (p.name || typeLabel) + '</span></div>' +
              '<div class="text-gray-400 text-xs mb-2">' + typeLabel + '</div>' +
              '<div class="text-gray-300 text-sm truncate" title="' + addrEsc + '">' + addrEsc + '</div>' +
              '<div class="flex flex-wrap items-center gap-2 mt-2">' +
                '<button type="button" class="btn-select-meeting px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors" data-msg="' + msg.replace(/"/g, '&quot;') + '">Select meeting point</button>' +
                navBtns +
              '</div></div>';
          }).join('');
          safeZonesList.querySelectorAll('.btn-select-meeting').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var msg = btn.getAttribute('data-msg');
              if (msg && typeof sendMeetingPointToChat === 'function') sendMeetingPointToChat(msg);
              closeSafeZonesModal();
            });
          });
          safeZonesList.querySelectorAll('.btn-nav-waze').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var lat = btn.getAttribute('data-lat');
              var lon = btn.getAttribute('data-lon');
              if (lat != null && lon != null) window.open('https://waze.com/ul?ll=' + lat + ',' + lon + '&navigate=yes', '_blank', 'noopener,noreferrer');
            });
          });
          safeZonesList.querySelectorAll('.btn-nav-gmaps').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var lat = btn.getAttribute('data-lat');
              var lon = btn.getAttribute('data-lon');
              if (lat != null && lon != null) window.open('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lon, '_blank', 'noopener,noreferrer');
            });
          });
        }
      })
      .catch(function (err) {
        if (safeZonesSpinner) safeZonesSpinner.classList.add('hidden');
        if (safeZonesError) {
          safeZonesError.textContent = 'Could not load safe places. Check your connection or try again.';
          safeZonesError.classList.remove('hidden');
        }
      });
  }

  function closeSafeZonesModal() {
    if (safeZonesModal) {
      safeZonesModal.classList.add('hidden');
      safeZonesModal.setAttribute('aria-hidden', 'true');
    }
  }

  function sendMeetingPointToChat(msg) {
    var input = document.getElementById('messages-input');
    if (input) {
      input.value = msg;
      input.focus();
    }
    var messagesSection = document.getElementById('messages-section');
    if (messagesSection && typeof showSection === 'function') showSection('messages-section');
  }

  var safeZonesCard = document.getElementById('safe-zones-card');
  var safeZonesClose = document.getElementById('safe-zones-close');
  var safeZonesBackdrop = document.getElementById('safe-zones-backdrop');
  var activeTradeChooseMeetingBtn = document.getElementById('active-trade-choose-meeting-btn');
  if (safeZonesCard) {
    safeZonesCard.addEventListener('click', openSafeZonesModal);
    safeZonesCard.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSafeZonesModal(); } });
  }
  if (safeZonesClose) safeZonesClose.addEventListener('click', closeSafeZonesModal);
  if (safeZonesBackdrop) safeZonesBackdrop.addEventListener('click', closeSafeZonesModal);
  if (activeTradeChooseMeetingBtn) activeTradeChooseMeetingBtn.addEventListener('click', openSafeZonesModal);

  // ---------------------------------------------------------------------------
  // Escape closes modals
  // ---------------------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (productDetailPopover && productDetailPopover.classList.contains('active')) closeProductDetailPopover();
    else if (tradeModal && !tradeModal.classList.contains('hidden')) closeTradeModal();
    else if (verifyModal && !verifyModal.classList.contains('hidden')) closeVerifyModal();
    else if (safeZonesModal && !safeZonesModal.classList.contains('hidden')) closeSafeZonesModal();
  });

  // ---------------------------------------------------------------------------
  // Price list: local market (marketService) or fallback to window.products
  // ---------------------------------------------------------------------------
  var priceListFilter = 'all';
  var priceListSort = 'name';
  var priceListSearchDebounce;

  function renderPriceList() {
    var tbody = document.getElementById('price-list-tbody');
    var countEl = document.querySelector('#price-list-section .text-gray-500.text-sm.mb-4');
    var searchInput = document.getElementById('price-list-search');

    if (window.marketService && tbody) {
      var query = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
      if (countEl) countEl.textContent = 'טוען...';
      window.marketService.searchMarketItems(query).then(function (items) {
        var list = items.slice();
        if (priceListFilter === 'shoes') list = list.filter(function (p) { return ['Nike', 'Adidas', 'New Balance', 'Salomon', 'Asics', 'Converse', 'Balenciaga', 'Bape'].indexOf(p.brand) >= 0; });
        if (priceListFilter === 'clothing') list = list.filter(function (p) { return ['Zara', 'H&M', 'Fear of God', 'Stussy', 'Supreme', 'Carhartt WIP', 'Palace', 'Kith', 'Off-White', 'The North Face', 'Uniqlo', 'Levi\'s', 'Comme des Garçons'].indexOf(p.brand) >= 0; });
        if (priceListSort === 'name') list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
        if (priceListSort === 'price') list.sort(function (a, b) { return (a.resellPrice || a.price || 0) - (b.resellPrice || b.price || 0); });

        var rows = list.map(function (p) {
          var retail = p.retailPrice || 0;
          var resell = p.resellPrice || 0;
          var hist = p.priceHistory || [];
          var change = hist.length >= 2 ? hist[hist.length - 1].value - hist[hist.length - 2].value : 0;
          var changeCR = Math.round(change * USD_TO_CR);
          var changeClass = change >= 0 ? 'text-fi-success' : 'text-red-400';
          var changeStr = change >= 0 ? '↑ +' + changeCR.toLocaleString() + ' CR' : '↓ -' + Math.abs(changeCR).toLocaleString() + ' CR';
          var priceRangeCRStr = formatPriceRangeCR(retail, resell);
          var vals = hist.slice(-4).map(function (h) { return h.value; });
          var min = Math.min.apply(null, vals.length ? vals : [0]);
          var max = Math.max.apply(null, vals.length ? vals : [1]);
          var range = max - min || 1;
          var barHeights = vals.map(function (v) { return ((v - min) / range) * 100; });
          var barColor = change >= 0 ? 'bg-fi-success' : 'bg-red-500';
          var bars = barHeights.map(function (h) { return '<span class="w-1 ' + barColor + ' rounded-sm" style="height:' + h + '%"></span>'; }).join('');
          var safeName = (p.name || '').replace(/"/g, '&quot;');
          return '<tr class="hover:bg-white/5"><td class="py-3 px-4"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden"><img src="' + (p.imageURL || p.image || '') + '" alt="" class="w-full h-full object-cover" onerror="this.style.display=\'none\'"></div><div><div class="font-medium text-white">' + (p.name || '') + '</div><div class="text-gray-500 text-xs">' + (p.brand || '') + '</div></div></div></td><td class="py-3 px-4"><div class="text-white font-semibold">' + priceRangeCRStr + '</div><div class="text-gray-500 text-xs">Market Range</div></td><td class="py-3 px-4"><span class="' + changeClass + '">' + changeStr + '</span></td><td class="py-3 px-4"><div class="w-16 h-8 flex items-end gap-0.5">' + bars + '</div></td><td class="py-3 px-4 text-right"><button type="button" class="price-list-view-details px-3 py-1.5 rounded-lg bg-fi-accent text-black text-xs font-semibold hover:bg-fi-accent-hover transition-colors" data-product-id="' + (p.id || '') + '" data-tooltip="Open full details">View Details</button></td></tr>';
        }).join('');
        tbody.innerHTML = rows;
        if (countEl) countEl.textContent = 'Showing ' + list.length + ' of ' + items.length + ' items';

        document.querySelectorAll('#price-list-section .price-list-view-details').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-product-id');
            var item = list.find(function (x) { return String(x.id) === String(id); });
            if (item) openPriceListDetailCard(item);
          });
        });
      });
      return;
    }

    if (!tbody || !window.products) return;
    var list = window.products.slice();
    if (priceListFilter === 'shoes') list = list.filter(function (p) { return ['Nike', 'Adidas', 'New Balance', 'Salomon', 'Asics', 'Converse'].indexOf(p.brand) >= 0; });
    if (priceListFilter === 'clothing') list = list.filter(function (p) { return p.brand === 'Clothing'; }); // mock: no clothing, so empty or keep all
    if (priceListSort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (priceListSort === 'price') list.sort(function (a, b) { return a.price - b.price; });

    var rows = list.map(function (p) {
      var hist = p.priceHistory || [];
      var change = hist.length >= 2 ? hist[hist.length - 1].value - hist[hist.length - 2].value : 0;
      var changeCR = Math.round(change * USD_TO_CR);
      var changeClass = change >= 0 ? 'text-fi-success' : 'text-red-400';
      var changeStr = change >= 0 ? '↑ +' + changeCR.toLocaleString() + ' CR' : '↓ -' + Math.abs(changeCR).toLocaleString() + ' CR';
      var priceRangeCRStr = formatPriceRangeCR(p.priceLow, p.priceHigh);
      var vals = hist.slice(-4).map(function (h) { return h.value; });
      var min = Math.min.apply(null, vals.length ? vals : [0]);
      var max = Math.max.apply(null, vals.length ? vals : [1]);
      var range = max - min || 1;
      var barHeights = vals.map(function (v) { return ((v - min) / range) * 100; });
      var barColor = change >= 0 ? 'bg-fi-success' : 'bg-red-500';
      var bars = barHeights.map(function (h) { return '<span class="w-1 ' + barColor + ' rounded-sm" style="height:' + h + '%"></span>'; }).join('');
      var safeName = p.name.replace(/"/g, '&quot;');
      return '<tr class="hover:bg-white/5"><td class="py-3 px-4"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden"><img src="' + p.imageURL + '" alt="" class="w-full h-full object-cover" onerror="this.style.display=\'none\'"></div><div><div class="font-medium text-white">' + p.name + '</div><div class="text-gray-500 text-xs">' + p.brand + '</div></div></div></td><td class="py-3 px-4"><div class="text-white font-semibold">' + priceRangeCRStr + '</div><div class="text-gray-500 text-xs">Market Range</div></td><td class="py-3 px-4"><span class="' + changeClass + ' flex items-center gap-1">' + changeStr + '</span></td><td class="py-3 px-4"><div class="w-16 h-8 flex items-end gap-0.5">' + bars + '</div></td><td class="py-3 px-4 text-right"><button type="button" class="price-list-view-details px-3 py-1.5 rounded-lg bg-fi-accent text-white text-xs font-semibold hover:bg-fi-accent-hover transition-colors" data-product-id="' + (p.id || '') + '" data-product-name="' + safeName + '" data-tooltip="Open full details and price chart for this item">View Details</button></td></tr>';
    }).join('');
    tbody.innerHTML = rows;

    var countEl = document.querySelector('#price-list-section .text-gray-500.text-sm.mb-4');
    if (countEl) countEl.textContent = 'Showing ' + list.length + ' of ' + window.products.length + ' items';

    document.querySelectorAll('#price-list-section .price-list-view-details').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-product-id');
        var p = window.products && id ? window.products.find(function (x) { return x.id === id; }) : null;
        if (p) openPriceListDetailCard(p);
      });
    });
  }

  document.querySelectorAll('#price-list-section .flex-wrap button').forEach(function (btn) {
    var t = btn.textContent.trim();
    if (t === 'All') { btn.addEventListener('click', function () { priceListFilter = 'all'; renderPriceList(); }); }
    if (t === 'Shoes') { btn.addEventListener('click', function () { priceListFilter = 'shoes'; renderPriceList(); }); }
    if (t === 'Clothing') { btn.addEventListener('click', function () { priceListFilter = 'clothing'; renderPriceList(); }); }
    if (t.indexOf('Sort by Name') >= 0) { btn.addEventListener('click', function () { priceListSort = priceListSort === 'name' ? 'price' : 'name'; renderPriceList(); }); }
  });

  var plSearch = document.getElementById('price-list-search');
  if (plSearch) {
    plSearch.addEventListener('input', function () {
      clearTimeout(priceListSearchDebounce);
      priceListSearchDebounce = setTimeout(renderPriceList, 400);
    });
    plSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') renderPriceList();
    });
  }

  // ---------------------------------------------------------------------------
  // Confirm Buy (from buy confirmation modal): deduct total, first-buy cashback
  // ---------------------------------------------------------------------------
  document.addEventListener('confirm-buy', function (e) {
    var total = e.detail && e.detail.total;
    var feeAmount = e.detail && e.detail.feeAmount;
    if (typeof total !== 'number' || total <= 0) return;
    document.dispatchEvent(new CustomEvent('balance-deduct', { detail: { amount: total } }));
    var firstBuy = localStorage.getItem(FIRST_BUY_KEY) !== '1';
    if (firstBuy && typeof feeAmount === 'number' && feeAmount > 0) {
      localStorage.setItem(FIRST_BUY_KEY, '1');
      document.dispatchEvent(new CustomEvent('lucky-wheel-credits', { detail: { amount: feeAmount } }));
    }
    if (pendingBuyProduct && typeof startActiveTrade === 'function') {
      startActiveTrade({ name: pendingBuyProduct.name, id: pendingBuyProduct.id });
      pendingBuyProduct = null;
    }
    alert('Purchase complete! You bought the item. ' + (firstBuy ? 'First-trade fee refunded as credits.' : ''));
  });

  // ---------------------------------------------------------------------------
  // Balance sync: deductions (buy, withdraw, trade fee) from index.html
  // ---------------------------------------------------------------------------
  document.addEventListener('balance-deduct', function (e) {
    var amt = e.detail && e.detail.amount;
    if (typeof amt === 'number' && amt > 0) {
      balance -= amt;
      var headerBalance = document.getElementById('header-balance');
      var tradeBalance = document.getElementById('trade-your-balance');
      if (headerBalance) headerBalance.textContent = balance.toLocaleString() + ' CR';
      if (tradeBalance) tradeBalance.textContent = balance.toLocaleString();
    }
  });

  // ---------------------------------------------------------------------------
  // Balance sync: credits added (TOP UP Done) so app.js balance stays in sync
  // ---------------------------------------------------------------------------
  document.addEventListener('balance-added', function (e) {
    var amt = e.detail && e.detail.amount;
    if (typeof amt === 'number' && amt > 0) {
      balance += amt;
    }
  });

  // ---------------------------------------------------------------------------
  // PRO Membership: sync balance when user gets 500 bonus credits
  // ---------------------------------------------------------------------------
  document.addEventListener('pro-subscribed', function () {
    balance += 500;
    var headerBalance = document.getElementById('header-balance');
    if (headerBalance) headerBalance.textContent = balance.toLocaleString() + ' CR';
  });

  // ---------------------------------------------------------------------------
  // When currency changes (from PS settings), re-render all prices
  // ---------------------------------------------------------------------------
  document.addEventListener('currency-changed', function () {
    renderProductGrid();
    renderPriceList();
    if (currentDetailProduct) {
      var rangeEl = document.getElementById('product-detail-range');
      if (rangeEl) rangeEl.textContent = formatPriceRangeCR(currentDetailProduct.priceLow, currentDetailProduct.priceHigh);
      var chartEl = document.getElementById('product-detail-chart');
      var yAxisEl = document.getElementById('product-detail-yaxis');
      var xAxisEl = document.getElementById('product-detail-xaxis');
      if (chartEl && yAxisEl && xAxisEl) {
        renderTradingViewChart(chartEl, yAxisEl, xAxisEl, currentDetailProduct.priceHistory, currentChartRange, undefined, currentDetailProduct.priceLow, currentDetailProduct.priceHigh);
      }
    }
    if (priceListDetailCurrentItem && priceListDetailWrap && !priceListDetailWrap.classList.contains('hidden')) {
      fillPriceListDetailCard(priceListDetailCurrentItem);
    }
  });

  // ---------------------------------------------------------------------------
  // Init: render grid and price list when DOM ready (products loaded from mock-data.js)
  // ---------------------------------------------------------------------------
  function init() {
    renderProductGrid();
    renderPriceList();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
