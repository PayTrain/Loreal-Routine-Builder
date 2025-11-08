/* ===================== Product Listing Logic (unchanged outward behavior) ===================== */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// Keep initial products placeholder exactly as before
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");
}

categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );
  displayProducts(filteredProducts);
});

/* ===================== Chatbot Inner Workings (from previous project) ===================== */
// System prompt carried over from previous implementation
const SYSTEM_PROMPT = `You are an official L'Oréal product assistant. ONLY answer questions related to L'Oréal products, skincare and haircare routines, and product recommendations. If a user asks about non-L'Oréal products or unrelated topics, politely explain you only provide L'Oréal-specific information and offer comparable L'Oréal alternatives when possible. Ask clarifying questions about skin type, hair type, concerns, sensitivities, and budget when needed. Do not provide medical, legal, or diagnostic advice — direct users to a professional in those cases. Keep answers friendly, factual, concise, and include product names and recommended usage steps when relevant.`;

// Cloudflare Worker endpoint (proxy to OpenAI) — hides API key
const WORKER_URL = "https://loreal-chatbot-worker.pmackmurphy.workers.dev/";

// Conversation history (no initial greeting per current project requirement)
let chatHistory = [];

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

  if (scrollTo === "lastUserTop") {
    const userMessages = chatWindow.querySelectorAll(".chat-message.user");
    const lastUser = userMessages[userMessages.length - 1];
    if (lastUser) {
      chatWindow.scrollTop = lastUser.offsetTop - chatWindow.offsetTop;
    }
  } else {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

/* -------- Call OpenAI via Worker -------- */
async function callOpenAI() {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...chatHistory];
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
    renderChat({ scrollTo: "lastUserTop" });
  } catch (err) {
    chatHistory.push({
      role: "assistant",
      content: `Error: ${err.message}. Please try again.`,
    });
    renderChat();
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

  chatHistory.push({ role: "user", content: text });
  renderChat();
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Temporary thinking indicator
  chatHistory.push({
    role: "assistant",
    content: "Preparing a *fabulous* response just for you...",
  });
  renderChat();

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
