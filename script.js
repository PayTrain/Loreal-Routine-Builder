/* ===================== Product Listing Logic (unchanged outward behavior) ===================== */
const categoryFilter = document.getElementById("categoryFilter");
const searchBar = document.getElementById("searchBar");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* ===================== RTL Detection & Direction Setup (enhanced) ===================== */
// NOTE: We only persist a manual override (user toggle). Automatic detection is re-evaluated
// when the html[lang] attribute changes (e.g., via Google Translate) or periodically.

const RTL_LANGS = [
  "ar",
  "he",
  "fa",
  "ur",
  "ps",
  "sd",
  "ug",
  "yi",
  "dv",
  "ku",
  "ckb",
  "ks",
  "syr",
  "nqo",
];

function isRTLLanguageTag(tag = "") {
  const primary = String(tag).toLowerCase().split("-")[0];
  return RTL_LANGS.includes(primary);
}

function getGoogleTranslateLang() {
  // Primary: html lang attribute
  const htmlLang = document.documentElement.getAttribute("lang");
  if (htmlLang) return htmlLang.split("-")[0];
  // Fallback: cookie set by Google Translate (format: /source/target )
  const match = document.cookie.match(/googtrans=\/([a-zA-Z-]+)\//);
  if (match) return match[1].split("-")[0];
  return "";
}

function detectAutoDirection() {
  // 1. Explicit html lang / Google Translate
  const gtLang = getGoogleTranslateLang();
  if (gtLang && isRTLLanguageTag(gtLang)) return "rtl";
  if (gtLang && !isRTLLanguageTag(gtLang)) return "ltr";
  // 2. Navigator languages
  const langs = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language || ""];
  const anyRTL = langs.some(isRTLLanguageTag);
  return anyRTL ? "rtl" : "ltr";
}

function applyDirection(dir) {
  const val = dir === "rtl" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", val);
  document.body.classList.toggle("rtl", val === "rtl");
}

function getDirOverride() {
  try {
    const o = localStorage.getItem("uiDirOverride");
    if (o === "rtl" || o === "ltr") return o;
    return null; // 'auto' or absent => no override
  } catch (e) {
    return null;
  }
}

function setDirOverride(value) {
  try {
    if (value === null || value === "auto") {
      localStorage.removeItem("uiDirOverride");
    } else {
      localStorage.setItem("uiDirOverride", value);
    }
  } catch (e) {
    /* ignore */
  }
}

function refreshDirection() {
  const override = getDirOverride();
  const dir = override || detectAutoDirection();
  applyDirection(dir);
}

// Observe html lang attribute & poll for GT cookie changes
let lastGTLang = getGoogleTranslateLang();
function periodicLangCheck() {
  const current = getGoogleTranslateLang();
  if (current !== lastGTLang && getDirOverride() === null) {
    lastGTLang = current;
    refreshDirection();
  }
}
setInterval(periodicLangCheck, 1500);

// Attribute observer for html[lang]
new MutationObserver(() => {
  if (getDirOverride() === null) refreshDirection();
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang"],
});

// Storage listener (sync across tabs)
window.addEventListener("storage", (e) => {
  if (e.key === "uiDirOverride") refreshDirection();
});

// Initialize direction ASAP (after DOM ready minimal)
refreshDirection();

// Update placeholder text based on screen size
function updatePlaceholderText() {
  if (window.innerWidth <= 575.98) {
    // Mobile screens (Bootstrap sm breakpoint)
    userInput.placeholder = "Ask about products…";
  } else {
    // Larger screens
    userInput.placeholder = "Ask me about products or routines…";
  }
}

// Initial update
updatePlaceholderText();

// Update on window resize
window.addEventListener("resize", updatePlaceholderText);

// Modal elements for product descriptions
const modal = document.getElementById("productModal");
const modalContent = modal ? modal.querySelector(".modal-content") : null;
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalImage = document.getElementById("modalImage");
const modalBrand = document.getElementById("modalBrand");
const modalAddBtn = document.getElementById("modalAddBtn");
let lastFocusedEl = null; // to restore focus after closing modal
let currentModalProduct = null; // track the product shown in modal

// Keep initial products placeholder exactly as before
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// Store all products globally for filtering
let allProducts = [];
// Track current filter state
let currentCategory = "";
let currentSearchQuery = "";

async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// Initialize products on page load
async function initializeProducts() {
  allProducts = await loadProducts();
}

// Track selected products by id
let selectedProducts = [];
// Cache of the products currently shown in the grid for instant re-render
let lastDisplayedProducts = [];

// Load selected products from localStorage on page load
function loadSelectedProducts() {
  try {
    const saved = localStorage.getItem("selectedProducts");
    if (saved) {
      selectedProducts = JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading selected products:", error);
    selectedProducts = [];
  }
}

// Save selected products to localStorage
function saveSelectedProducts() {
  try {
    localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
  } catch (error) {
    console.error("Error saving selected products:", error);
  }
}

// Initialize selected products from localStorage
loadSelectedProducts();

function displayProducts(products) {
  // cache reference for immediate refreshes (e.g., when removing via Selected section)
  lastDisplayedProducts = products;
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some((p) => p.id === product.id);
      return `
        <div class="product-card${isSelected ? " selected" : ""}" data-id="${
        product.id
      }">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button class="info-btn" type="button" aria-label="View details for ${
              product.name
            }">Details</button>
          </div>
          ${
            isSelected
              ? '<div class="selected-check"><i class="fa-solid fa-check"></i></div>'
              : ""
          }
        </div>
      `;
    })
    .join("");

  // Add click listeners for selection
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const product = products.find((p) => p.id == id);
      const alreadySelected = selectedProducts.some((p) => p.id == id);
      if (alreadySelected) {
        selectedProducts = selectedProducts.filter((p) => p.id != id);
      } else {
        selectedProducts.push(product);
      }
      // Save to localStorage whenever selection changes
      saveSelectedProducts();
      displayProducts(products);
      updateSelectedProducts();
    });
  });

  // Info buttons open the modal, without toggling selection
  const infoButtons = productsContainer.querySelectorAll(".info-btn");
  infoButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".product-card");
      const id = card.getAttribute("data-id");
      const product = products.find((p) => p.id == id);
      openProductModal(product, btn);
    });
  });
}

function updateSelectedProducts() {
  const selectedList = document.getElementById("selectedProductsList");
  const clearAllBtn = document.getElementById("clearAllBtn");

  if (!selectedProducts.length) {
    selectedList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    // Hide the Clear All button when no products are selected
    if (clearAllBtn) {
      clearAllBtn.style.display = "none";
    }
    return;
  }

  // Show the Clear All button when products are selected
  if (clearAllBtn) {
    clearAllBtn.style.display = "inline-flex";
  }

  // Build uniform card elements for selected products
  selectedList.innerHTML = selectedProducts
    .map((product) => {
      return `
        <div class="selected-card" data-id="${product.id}">
          <button class="remove-selected" aria-label="Remove ${product.name}" title="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <img src="${product.image}" alt="${product.name}">
          <div class="card-title">${product.name}</div>
        </div>
      `;
    })
    .join("");

  // Remove button logic
  selectedList.querySelectorAll(".remove-selected").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".selected-card");
      const id = card.getAttribute("data-id");
      selectedProducts = selectedProducts.filter((p) => p.id != id);
      // Save to localStorage after removing a product
      saveSelectedProducts();
      // Immediately refresh the products grid using cached results (no fetch delay)
      if (lastDisplayedProducts && lastDisplayedProducts.length) {
        displayProducts(lastDisplayedProducts);
      }
      updateSelectedProducts();
    });
  });
}

/* ===================== Fuzzy Search Logic ===================== */
// Define keyword synonyms and related terms for smart fuzzy matching
const searchSynonyms = {
  // Skincare terms
  moisturizer: [
    "lotion",
    "cream",
    "hydrating",
    "hydration",
    "moisture",
    "nourishing",
  ],
  serum: ["treatment", "concentrate", "booster", "essence"],
  cleanser: ["wash", "cleansing", "facial wash", "face wash", "makeup remover"],
  sunscreen: ["spf", "sun protection", "suncare", "uv protection"],
  retinol: ["anti-aging", "anti aging", "wrinkle", "fine lines"],
  "vitamin c": ["brightening", "radiance", "glow", "luminous"],
  exfoliate: ["scrub", "polish", "resurface", "renew", "peel"],

  // Hair terms
  shampoo: ["hair wash", "cleansing"],
  conditioner: ["hair treatment", "detangler"],
  hairspray: ["hair spray", "finishing spray", "hold spray"],

  // Makeup terms
  foundation: ["base", "coverage", "complexion"],
  mascara: ["lashes", "eye makeup"],
  lipstick: ["lip color", "lip balm", "rouge"],
  eyeshadow: ["eye shadow", "palette", "eye makeup"],

  // Skin types and concerns
  acne: ["breakout", "blemish", "pimple", "spot treatment"],
  sensitive: ["gentle", "soothing", "calming", "hypoallergenic"],
  oily: ["oil control", "mattifying", "shine control"],
  dry: ["hydrating", "nourishing", "replenishing"],
  aging: ["wrinkle", "firming", "lifting", "youth"],
};

// Helper function to get all related terms for a word
function getRelatedTerms(word) {
  const lowerWord = word.toLowerCase();
  const terms = [lowerWord];

  // Check if word is a key in synonyms
  if (searchSynonyms[lowerWord]) {
    terms.push(...searchSynonyms[lowerWord]);
  }

  // Check if word appears in any synonym array
  for (const [key, values] of Object.entries(searchSynonyms)) {
    if (values.includes(lowerWord)) {
      terms.push(key, ...values);
    }
  }

  return [...new Set(terms)]; // Remove duplicates
}

// Smart fuzzy search matching function
function matchesSearchQuery(product, query) {
  if (!query || query.trim() === "") return true;

  // Normalize query to lowercase
  const normalizedQuery = query.toLowerCase().trim();

  // Split query into words for multi-word search
  const queryWords = normalizedQuery.split(/\s+/);

  // Create searchable text from product fields
  const searchableText = [
    product.name,
    product.brand,
    product.description,
    product.category,
  ]
    .join(" ")
    .toLowerCase();

  // Check each query word
  return queryWords.every((word) => {
    // Get all related terms for this word (fuzzy matching)
    const relatedTerms = getRelatedTerms(word);

    // Check if any related term appears in the searchable text
    return relatedTerms.some((term) => searchableText.includes(term));
  });
}

/* ===================== Combined Filter Logic ===================== */
// Apply both category and search filters together
function applyFilters() {
  let filteredProducts = allProducts;

  // Apply category filter if selected
  if (currentCategory) {
    filteredProducts = filteredProducts.filter(
      (product) => product.category === currentCategory
    );
  }

  // Apply search filter
  if (currentSearchQuery) {
    filteredProducts = filteredProducts.filter((product) =>
      matchesSearchQuery(product, currentSearchQuery)
    );
  }

  // Update display
  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search. Try different keywords or select a category.
      </div>
    `;
  } else {
    displayProducts(filteredProducts);
  }
}

/* ===================== Event Listeners for Filters ===================== */
// Category filter event listener
categoryFilter.addEventListener("change", (e) => {
  currentCategory = e.target.value;
  applyFilters();
});

// Search bar event listener - filters in real time as user types
searchBar.addEventListener("input", (e) => {
  currentSearchQuery = e.target.value;

  // If search is active but no category selected, show all products that match search
  if (currentSearchQuery && !currentCategory) {
    // Auto-enable searching across all products
    applyFilters();
  } else if (currentCategory || currentSearchQuery) {
    applyFilters();
  } else {
    // If both are empty, show placeholder
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
  }
});

// Clear All button functionality
const clearAllBtn = document.getElementById("clearAllBtn");
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    // Clear the selected products array
    selectedProducts = [];
    // Save empty array to localStorage
    saveSelectedProducts();
    // Refresh the products grid if products are currently displayed
    if (lastDisplayedProducts && lastDisplayedProducts.length) {
      displayProducts(lastDisplayedProducts);
    }
    // Update the selected products section
    updateSelectedProducts();
  });
}

// Initial update for selected products section
updateSelectedProducts();

// Initialize products on page load
initializeProducts();

/* ===================== Custom Dropdown for categoryFilter (panel only) ===================== */
// Modern custom panel replicating the select's options without altering the select styling itself.
// Accessibility notes:
// - We keep the native <select> for semantics and fallback; intercept mouse + some keyboard to show a custom list.
// - Selection updates dispatch a native 'change' event so existing logic works unmodified.
(function setupCustomCategoryDropdown() {
  const selectEl = categoryFilter;
  if (!selectEl) return;

  let isOpen = false;
  let activeIndex = -1;
  let optionNodes = [];

  // Create floating panel container
  const panel = document.createElement("div");
  panel.className = "custom-select-dropdown";
  panel.style.display = "none";
  panel.setAttribute("role", "listbox");
  document.body.appendChild(panel);

  function collectOptions() {
    const arr = [];
    for (const opt of selectEl.options) {
      if (opt.disabled) continue; // skip placeholder disabled
      arr.push({ value: opt.value, label: opt.textContent });
    }
    return arr;
  }

  function renderPanel() {
    const options = collectOptions();
    const current = selectEl.value;
    panel.innerHTML = options
      .map((o) => {
        const selected = o.value === current;
        const selAttr = selected ? ' aria-selected="true"' : "";
        const check = selected
          ? '<i class="fa-solid fa-check checkmark" aria-hidden="true"></i>'
          : "";
        return `<div class="dropdown-option" role="option" data-value="${o.value}"${selAttr}>${o.label}${check}</div>`;
      })
      .join("");
    optionNodes = Array.from(panel.querySelectorAll(".dropdown-option"));
    // Default: no keyboard-highlight on open; keep all options in uniform state
    // We still track the selected item via aria-selected for styling
    activeIndex = -1;
  }

  function positionPanel() {
    const rect = selectEl.getBoundingClientRect();
    panel.style.width = rect.width + "px";
    panel.style.left = rect.left + "px";
    panel.style.top = rect.bottom + 6 + "px"; // small gap below select
  }

  function openPanel() {
    if (isOpen) return;
    renderPanel();
    positionPanel();
    panel.style.display = "block";
    isOpen = true;
    highlightActive();
    addGlobalListeners();
  }

  function closePanel() {
    if (!isOpen) return;
    panel.style.display = "none";
    isOpen = false;
    removeGlobalListeners();
  }

  function selectIndex(i) {
    if (i < 0 || i >= optionNodes.length) return;
    const node = optionNodes[i];
    const value = node.getAttribute("data-value") || "";
    if (value !== selectEl.value) {
      selectEl.value = value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closePanel();
    selectEl.focus();
  }

  function highlightActive() {
    optionNodes.forEach((n, idx) => {
      if (idx === activeIndex) {
        n.classList.add("hover");
        // Only attempt to scroll if the panel is actually scrollable
        if (panel.scrollHeight > panel.clientHeight) {
          n.scrollIntoView({ block: "nearest" });
        }
      } else {
        n.classList.remove("hover");
      }
    });
  }

  function moveActive(delta) {
    if (!optionNodes.length) return;
    if (activeIndex === -1) {
      // First keyboard move sets an initial index depending on direction
      activeIndex = delta > 0 ? 0 : optionNodes.length - 1;
    } else {
      activeIndex = Math.max(
        0,
        Math.min(optionNodes.length - 1, activeIndex + delta)
      );
    }
    highlightActive();
  }

  function onDocMouseDown(e) {
    if (!panel.contains(e.target) && !selectEl.contains(e.target)) {
      closePanel();
    }
  }

  function onDocKeyDown(e) {
    if (!isOpen) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closePanel();
        break;
      case "ArrowDown":
        e.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive(-1);
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex === -1) {
          const selIdx = optionNodes.findIndex(
            (n) => n.getAttribute("aria-selected") === "true"
          );
          selectIndex(selIdx >= 0 ? selIdx : 0);
        } else {
          selectIndex(activeIndex);
        }
        break;
    }
  }

  function onWinResizeScroll() {
    if (!isOpen) return;
    positionPanel();
  }

  function addGlobalListeners() {
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    window.addEventListener("resize", onWinResizeScroll);
    window.addEventListener("scroll", onWinResizeScroll, true);
  }
  function removeGlobalListeners() {
    document.removeEventListener("mousedown", onDocMouseDown);
    document.removeEventListener("keydown", onDocKeyDown);
    window.removeEventListener("resize", onWinResizeScroll);
    window.removeEventListener("scroll", onWinResizeScroll, true);
  }

  // Mouse interaction: replace native panel
  selectEl.addEventListener("mousedown", (e) => {
    e.preventDefault(); // prevent native dropdown
    selectEl.focus();
    if (isOpen) closePanel();
    else openPanel();
  });

  // Keyboard interaction while focus on select
  selectEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        openPanel();
      } else if (e.key === "ArrowDown") {
        moveActive(1);
      } else if (e.key === "Enter") {
        if (activeIndex === -1) {
          const selIdx = optionNodes.findIndex(
            (n) => n.getAttribute("aria-selected") === "true"
          );
          selectIndex(selIdx >= 0 ? selIdx : 0);
        } else {
          selectIndex(activeIndex);
        }
      }
    } else if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closePanel();
    }
  });

  // Click selection inside panel
  panel.addEventListener("click", (e) => {
    const opt = e.target.closest(".dropdown-option");
    if (!opt) return;
    const idx = optionNodes.indexOf(opt);
    if (idx !== -1) selectIndex(idx);
  });
})();

/* ===================== Accessible Modal: open/close + focus trap ===================== */
function getFocusableElements(container) {
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll(selectors.join(","))).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

let keydownHandler = null;
let outsideClickHandler = null;

function openProductModal(product, triggerEl) {
  if (!modal || !modalContent) return;
  lastFocusedEl = triggerEl || document.activeElement;

  // Fill content
  currentModalProduct = product;
  modalTitle.textContent = `${product.name}`;
  modalDescription.textContent = product.description;
  if (modalImage) {
    modalImage.src = product.image;
    modalImage.alt = product.name;
  }
  if (modalBrand) {
    modalBrand.textContent = product.brand;
  }

  // Configure Add button state and handler
  if (modalAddBtn) {
    const isAlreadySelected = selectedProducts.some((p) => p.id == product.id);
    modalAddBtn.disabled = isAlreadySelected;
    modalAddBtn.setAttribute(
      "aria-disabled",
      isAlreadySelected ? "true" : "false"
    );
    // Keep the label consistent as "Add"; rely on disabled state + CSS for UX
    const labelSpan = modalAddBtn.querySelector("span");
    if (labelSpan) labelSpan.textContent = "Add";

    // Bind click (overwrite previous to avoid stacking listeners)
    modalAddBtn.onclick = () => {
      const stillSelected = selectedProducts.some((p) => p.id == product.id);
      if (!stillSelected) {
        selectedProducts.push(product);
        // Save to localStorage after adding a product
        saveSelectedProducts();
      }
      // Refresh UI
      if (lastDisplayedProducts && lastDisplayedProducts.length) {
        displayProducts(lastDisplayedProducts);
      }
      updateSelectedProducts();
      closeProductModal();
    };
  }

  // Show modal
  modal.removeAttribute("hidden");
  document.body.classList.add("modal-open");

  // Focus the modal content (so screen readers land inside the dialog)
  modalContent.focus();

  // Close on overlay click (clicking background area)
  outsideClickHandler = (e) => {
    if (e.target === modal) {
      closeProductModal();
    }
  };
  modal.addEventListener("mousedown", outsideClickHandler);

  // Keyboard handling: Esc to close, Tab to trap focus
  keydownHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeProductModal();
      return;
    }
    if (e.key === "Tab") {
      const focusables = getFocusableElements(modalContent);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };
  document.addEventListener("keydown", keydownHandler);

  // Close button
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeProductModal);
  }
}

function closeProductModal() {
  if (!modal) return;
  modal.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
  // Cleanup listeners
  if (outsideClickHandler) {
    modal.removeEventListener("mousedown", outsideClickHandler);
    outsideClickHandler = null;
  }
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (modalCloseBtn) {
    modalCloseBtn.removeEventListener("click", closeProductModal);
  }
  // Restore focus back to the element that opened the modal
  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
    lastFocusedEl.focus();
  }

  // Clear current product reference
  currentModalProduct = null;
}

/* ===================== Chatbot Inner Workings (from previous project) ===================== */
// System prompt refined to include L'Oréal brands, scope limits, and explicit follow-up behavior
const SYSTEM_PROMPT = `You are an official L'Oréal product assistant.

Scope and limitations:
- Only answer questions related to beauty: skincare, haircare, makeup, fragrance, suncare, men's grooming, and product routines/recommendations.
- Stay strictly within the L'Oréal brand portfolio (owned or licensed). Treat sub-brands as L'Oréal brands.
- The following brands are in scope (based on our catalog): CeraVe; La Roche-Posay; Vichy; L'Oréal Paris; Maybelline; Lancôme; Garnier; Kiehl's; Kérastase; SkinCeuticals; Urban Decay; Yves Saint Laurent (YSL Beauty); Redken.
- If asked about non-L'Oréal brands or unrelated topics (e.g., coding, finance, politics), politely decline and, when helpful, suggest comparable options from the brands above.
- Do not provide medical, legal, or diagnostic advice — recommend consulting a professional instead.

Conversation memory and follow-ups:
- Use the full conversation history to maintain context and continuity.
- Do not re-ask for details the user already provided (e.g., skin type, hair type, concerns). Infer from prior messages and profile first; only ask concise questions for missing info.
- After a routine is generated, answer follow-up questions ONLY if they relate to the generated routine or beauty topics.
- Reference previously selected products and the routine you provided when helpful. If a user asks something out of scope, briefly decline and redirect to relevant beauty topics or L'Oréal alternatives.

Assistant behavior:
- Ask clarifying questions about skin type, hair type, concerns, sensitivities, routine complexity, and budget when needed.
- Keep answers friendly, factual, concise, and, when relevant, include product names and recommended usage steps.
- Prefer step-by-step guidance and practical tips. Avoid repeating the entire routine unless asked.`;

// Cloudflare Worker endpoint (proxy to OpenAI) — hides API key
const WORKER_URL = "https://loreal-chatbot-worker.pmackmurphy.workers.dev/";

// Conversation history (no initial greeting per current project requirement)
let chatHistory = [];

// Optional: lightweight user profile memory (persisted locally if present)
let userProfile = loadUserProfile();

function loadUserProfile() {
  try {
    const raw = localStorage.getItem("userProfile");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveUserProfile(profile) {
  try {
    localStorage.setItem("userProfile", JSON.stringify(profile));
  } catch (e) {
    // ignore storage failures silently
  }
}

function formatProfileForPrompt(p = {}) {
  const parts = [];
  if (p.name) parts.push(`name=${p.name}`);
  if (p.skinType) parts.push(`skinType=${p.skinType}`);
  if (p.hairType) parts.push(`hairType=${p.hairType}`);
  if (Array.isArray(p.concerns) && p.concerns.length)
    parts.push(`concerns=${p.concerns.join("/")}`);
  if (Array.isArray(p.sensitivities) && p.sensitivities.length)
    parts.push(`sensitivities=${p.sensitivities.join("/")}`);
  if (p.budget) parts.push(`budget=${p.budget}`);
  if (p.fragrancePreference) parts.push(`fragrance=${p.fragrancePreference}`);
  return parts.join("; ");
}

// Lightweight extraction of profile hints from free text
function updateProfileFromUserText(text) {
  if (!text) return;
  const t = text.toLowerCase();

  // skin type
  const skinMap = [
    { key: "oily", value: "oily" },
    { key: "dry", value: "dry" },
    { key: "combination", value: "combination" },
    { key: "combo", value: "combination" },
    { key: "normal", value: "normal" },
    { key: "sensitive", value: "sensitive" },
  ];
  if (!userProfile.skinType) {
    for (const s of skinMap) {
      if (
        t.includes(`${s.key} skin`) ||
        t.includes(`skin is ${s.key}`) ||
        t.includes(`my skin is ${s.key}`)
      ) {
        userProfile.skinType = s.value;
        break;
      }
    }
  }

  // hair type
  const hairMap = [
    { key: "straight", value: "straight" },
    { key: "wavy", value: "wavy" },
    { key: "curly", value: "curly" },
    { key: "coily", value: "coily" },
    { key: "fine", value: "fine" },
    { key: "thick", value: "thick" },
  ];
  if (!userProfile.hairType) {
    for (const h of hairMap) {
      if (
        t.includes(`${h.key} hair`) ||
        t.includes(`hair is ${h.key}`) ||
        t.includes(`my hair is ${h.key}`)
      ) {
        userProfile.hairType = h.value;
        break;
      }
    }
  }

  // concerns
  const concernTerms = [
    "acne",
    "breakouts",
    "pimples",
    "redness",
    "hyperpigmentation",
    "dark spots",
    "uneven tone",
    "wrinkles",
    "fine lines",
    "texture",
    "large pores",
    "oiliness",
    "dryness",
    "dullness",
    "frizz",
    "dandruff",
    "hair loss",
  ];
  userProfile.concerns = Array.isArray(userProfile.concerns)
    ? userProfile.concerns
    : [];
  for (const term of concernTerms) {
    if (t.includes(term)) {
      if (!userProfile.concerns.includes(term)) {
        userProfile.concerns.push(term);
      }
    }
  }

  // sensitivities and fragrance preference
  if (!userProfile.fragrancePreference) {
    if (t.includes("fragrance-free") || t.includes("unscented")) {
      userProfile.fragrancePreference = "fragrance-free";
    } else if (
      t.includes("lightly fragranced") ||
      t.includes("ok with fragrance")
    ) {
      userProfile.fragrancePreference = "light fragrance ok";
    }
  }

  userProfile.sensitivities = Array.isArray(userProfile.sensitivities)
    ? userProfile.sensitivities
    : [];
  if (t.includes("sensitive to")) {
    // naive capture after "sensitive to"
    const m = t.match(/sensitive to\s+([a-z\-\s]+)/);
    if (m && m[1]) {
      const item = m[1].trim().split(/[\.,!]/)[0];
      if (item && !userProfile.sensitivities.includes(item)) {
        userProfile.sensitivities.push(item);
      }
    }
  }

  // budget hints
  if (!userProfile.budget) {
    if (
      t.includes("on a budget") ||
      t.includes("affordable") ||
      t.includes("drugstore")
    ) {
      userProfile.budget = "$";
    } else if (t.includes("mid-range") || t.includes("midrange")) {
      userProfile.budget = "$$";
    } else if (
      t.includes("luxury") ||
      t.includes("high-end") ||
      t.includes("high end")
    ) {
      userProfile.budget = "$$$";
    }
  }

  // persist after updates
  saveUserProfile(userProfile);
}

/* -------- Markdown + HTML escaping helpers (ported) -------- */
function escapeHtml(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p.innerHTML;
}

function applyInlineFormatting(text) {
  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, (_, p1) => `<strong>${p1}</strong>`);
  // Italic *text*
  text = text.replace(
    /(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g,
    (_, p1) => `<em>${p1}</em>`
  );
  // Italic _text_
  text = text.replace(
    /(?<!_)_(?!_)([^_]+?)_(?!_)/g,
    (_, p1) => `<em>${p1}</em>`
  );
  return text;
}

function formatMessage(text) {
  if (!text) return "";
  let safe = escapeHtml(text);
  const lines = safe.split(/\r?\n/);
  let formatted = "";

  // Track nested lists by indentation level (2+ spaces per level)
  const listStack = []; // [{ indent: number, type: 'ul'|'ol' }]

  const closeListsTo = (targetIndent) => {
    while (
      listStack.length &&
      listStack[listStack.length - 1].indent > targetIndent
    ) {
      const top = listStack.pop();
      formatted += `</${top.type}>`;
    }
  };

  const switchTopListType = (type, indentLevel) => {
    // Close one at the same level and open the requested type
    if (
      listStack.length &&
      listStack[listStack.length - 1].indent === indentLevel
    ) {
      const top = listStack.pop();
      formatted += `</${top.type}>`;
      formatted += `<${type}>`;
      listStack.push({ indent: indentLevel, type });
      return true;
    }
    return false;
  };

  const openListsUpTo = (indentLevel, type) => {
    let curIndent = listStack.length
      ? listStack[listStack.length - 1].indent
      : -1;
    while (curIndent < indentLevel) {
      formatted += `<${type}>`;
      curIndent += 1;
      listStack.push({ indent: curIndent, type });
    }
  };

  const getIndentLevel = (ws) => {
    if (!ws) return 0;
    // Convert tabs to two spaces and compute levels by 2-space increments
    const spaces = ws.replace(/\t/g, "  ").length;
    return Math.floor(spaces / 2);
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Blank line -> close lists and add a newline to separate paragraphs
    if (/^\s*$/.test(line)) {
      closeListsTo(-1);
      if (i < lines.length - 1) formatted += "\n";
      continue;
    }

    // Headings (# .. ######) — close any open lists first
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeListsTo(-1);
      const level = headingMatch[1].length;
      const content = applyInlineFormatting(headingMatch[2]);
      formatted += `<h${level}>${content}</h${level}>`;
      continue;
    }

    // Ordered list item: capture leading whitespace and content
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const indentLevel = getIndentLevel(orderedMatch[1]);
      const item = applyInlineFormatting(orderedMatch[2]);

      // Adjust nesting
      if (
        !listStack.length ||
        listStack[listStack.length - 1].indent < indentLevel
      ) {
        openListsUpTo(indentLevel, "ol");
      } else if (listStack[listStack.length - 1].indent > indentLevel) {
        closeListsTo(indentLevel);
      }

      // Ensure correct list type at this level
      const top = listStack[listStack.length - 1];
      if (!top || top.indent !== indentLevel) {
        // No list exactly at this level — open it
        openListsUpTo(indentLevel, "ol");
      } else if (top.type !== "ol") {
        switchTopListType("ol", indentLevel);
      }

      formatted += `<li>${item}</li>`;
      continue;
    }

    // Unordered list item: -, *, + with leading whitespace captured
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bulletMatch) {
      const indentLevel = getIndentLevel(bulletMatch[1]);
      const item = applyInlineFormatting(bulletMatch[2]);

      // Adjust nesting
      if (
        !listStack.length ||
        listStack[listStack.length - 1].indent < indentLevel
      ) {
        openListsUpTo(indentLevel, "ul");
      } else if (listStack[listStack.length - 1].indent > indentLevel) {
        closeListsTo(indentLevel);
      }

      // Ensure correct list type at this level
      const top = listStack[listStack.length - 1];
      if (!top || top.indent !== indentLevel) {
        openListsUpTo(indentLevel, "ul");
      } else if (top.type !== "ul") {
        switchTopListType("ul", indentLevel);
      }

      formatted += `<li>${item}</li>`;
      continue;
    }

    // Non-list paragraph line — close all lists first
    closeListsTo(-1);
    line = applyInlineFormatting(line);
    formatted += line;
    if (i < lines.length - 1) {
      formatted += "\n";
    }
  }

  // Close any remaining open lists
  closeListsTo(-1);
  return formatted;
}

/* -------- Render chat bubbles -------- */
function renderChat({ scrollTo } = {}) {
  chatWindow.innerHTML = "";
  chatHistory.forEach((msg) => {
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message ${msg.role}`;

    // Optional meta line (hide for now if desired)
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = msg.role === "user" ? "You" : "Advisor";
    wrapper.appendChild(meta);

    const body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML = formatMessage(msg.content);
    wrapper.appendChild(body);
    chatWindow.appendChild(wrapper);
  });

  // OFFSET of 20px above the target message
  const OFFSET = 20;

  if (scrollTo === "lastUserTop") {
    // Find the last user message element and align it 20px above the top of the scroll container
    const userMessages = chatWindow.querySelectorAll(".chat-message.user");
    const lastUser = userMessages[userMessages.length - 1];
    if (lastUser) {
      const containerRect = chatWindow.getBoundingClientRect();
      const lastRect = lastUser.getBoundingClientRect();
      const deltaTop = lastRect.top - containerRect.top; // distance from top of container
      const target = Math.max(0, chatWindow.scrollTop + deltaTop - OFFSET);
      chatWindow.scrollTop = target;
    }
  } else if (scrollTo === "lastAssistantTop") {
    // Find the last assistant message element and align it 20px above the top of the scroll container
    const assistantMessages = chatWindow.querySelectorAll(
      ".chat-message.assistant"
    );
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    if (lastAssistant) {
      const containerRect = chatWindow.getBoundingClientRect();
      const lastRect = lastAssistant.getBoundingClientRect();
      const deltaTop = lastRect.top - containerRect.top; // distance from top of container
      const target = Math.max(0, chatWindow.scrollTop + deltaTop - OFFSET);
      chatWindow.scrollTop = target;
    }
  } else {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

/* -------- Call OpenAI via Worker -------- */
async function callOpenAI() {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  if (userProfile && Object.keys(userProfile).length) {
    messages.push({
      role: "system",
      content: `User profile: ${formatProfileForPrompt(
        userProfile
      )}. Use this to tailor answers and remember during this session.`,
    });
  }
  messages.push(...chatHistory);
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    const data = await res.json();
    const assistantContent =
      data.choices?.[0]?.message?.content ??
      "Sorry, I did not receive a reply.";
    chatHistory.push({ role: "assistant", content: assistantContent });
    renderChat({ scrollTo: "lastAssistantTop" });
  } catch (err) {
    chatHistory.push({
      role: "assistant",
      content: `Error: ${err.message}. Please try again.`,
    });
    renderChat({ scrollTo: "lastAssistantTop" });
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

/* -------- Submit handler -------- */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Attempt to capture profile hints from the user's message (e.g., "oily skin")
  updateProfileFromUserText(text);

  chatHistory.push({ role: "user", content: text });
  renderChat({ scrollTo: "lastUserTop" });
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Temporary thinking indicator
  chatHistory.push({
    role: "assistant",
    content: "Preparing a *fabulous* response just for you...",
  });
  renderChat({ scrollTo: "lastUserTop" });

  // Remove indicator before actual API call
  chatHistory = chatHistory.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        m.content === "Preparing a *fabulous* response just for you..."
      )
  );

  await callOpenAI();
});

// Initial empty render to ensure chatWindow is cleared
renderChat();

/* ===================== Generate Routine Button Logic ===================== */
const generateRoutineBtn = document.getElementById("generateRoutine");

// Event listener for the Generate Routine button
generateRoutineBtn.addEventListener("click", async () => {
  // Check if any products are selected
  if (selectedProducts.length === 0) {
    // Update the placeholder message to show error
    const selectedList = document.getElementById("selectedProductsList");
    selectedList.innerHTML = `<div class="placeholder-message" style="color: #ff003b;">Please select at least one product to generate a routine</div>`;
    return;
  }

  // Build the user prompt with selected products (brand + product name)
  const productList = selectedProducts
    .map((product) => `${product.brand} ${product.name}`)
    .join(", ");

  const userPrompt = `Generate a personalized beauty routine using the following products: ${productList}.`;

  // Add user message to chat history
  chatHistory.push({ role: "user", content: userPrompt });
  renderChat({ scrollTo: "lastUserTop" });

  // Disable input and button during API call
  userInput.disabled = true;
  sendBtn.disabled = true;
  generateRoutineBtn.disabled = true;

  // Add thinking indicator
  chatHistory.push({
    role: "assistant",
    content: "Preparing a *fabulous* response just for you...",
  });
  renderChat({ scrollTo: "lastUserTop" });

  // Remove thinking indicator
  chatHistory = chatHistory.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        m.content === "Preparing a *fabulous* response just for you..."
      )
  );

  // Build detailed product information for the AI
  const productDetails = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  // Create enhanced system prompt for routine generation with brand guardrails
  const routineSystemPrompt = `You are an official L'Oréal product assistant specializing in creating and providing personalized beauty routines, beauty advice, and tailored answers for beauty-related questions.

Rules:
- Only produce routines related to beauty (skincare, haircare, makeup, fragrance, suncare, grooming) and only using L'Oréal portfolio brands.
- In-scope brands: CeraVe; La Roche-Posay; Vichy; L'Oréal Paris; Maybelline; Lancôme; Garnier; Kiehl's; Kérastase; SkinCeuticals; Urban Decay; Yves Saint Laurent (YSL Beauty); Redken. Treat sub-brands as L'Oréal.
- If any provided item is outside these brands or unrelated to beauty, exclude it and briefly state why.
- Do not give medical, legal, or diagnostic advice — recommend consulting a professional.

When given a list of products, create a step-by-step routine that:
1. Orders products logically (e.g., cleanse → treat → moisturize → protect)
2. Explains when to use each (AM/PM/both)
3. Provides brief application tips (how much, layering order, frequency)
4. Calls out key benefits of each product
Keep the routine practical, easy to follow, and tailored to the specific products provided.`;

  // Prepare messages with product details
  const routineMessages = [{ role: "system", content: routineSystemPrompt }];
  if (userProfile && Object.keys(userProfile).length) {
    routineMessages.push({
      role: "system",
      content: `User profile: ${formatProfileForPrompt(
        userProfile
      )}. Tailor routine to this context when relevant.`,
    });
  }
  routineMessages.push({
    role: "user",
    content: `Create a personalized routine using these products:\n\n${productDetails
      .map((p) => `**${p.brand} ${p.name}** (${p.category})\n${p.description}`)
      .join("\n\n")}`,
  });

  // Call OpenAI API
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: routineMessages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }

    const data = await res.json();
    const assistantContent =
      data.choices?.[0]?.message?.content ??
      "Sorry, I did not receive a reply.";

    // Add AI response to chat history
    chatHistory.push({ role: "assistant", content: assistantContent });
    renderChat({ scrollTo: "lastAssistantTop" });
  } catch (err) {
    chatHistory.push({
      role: "assistant",
      content: `Error: ${err.message}. Please try again.`,
    });
    renderChat({ scrollTo: "lastAssistantTop" });
  } finally {
    // Re-enable inputs
    userInput.disabled = false;
    sendBtn.disabled = false;
    generateRoutineBtn.disabled = false;
    userInput.focus();
  }
});
