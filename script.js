/* =========================================================
   AI RESEARCH ASSISTANT — SCRIPT.JS
   ========================================================= */

/* ------------------------------------------------------------
   1. GROQ API CONFIGURATION
   Paste your key below. Get one free at https://console.groq.com
   WARNING: This key is visible to anyone who views the page
   source/network tab. Fine for local/demo use; for a public
   deployment, proxy requests through a small backend instead.
------------------------------------------------------------- */
const GROQ_API_KEY = "YOUR_GROQ_API_KEY";  // <-- REPLACE WITH YOUR KEY
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are an expert AI Research Assistant. You help researchers, students, and academics with:
- Explaining AI, machine learning, deep learning, NLP, and computer vision concepts clearly
- Summarizing research papers and extracting key contributions
- Suggesting research methodologies and study designs
- Generating novel research questions and identifying research gaps
- Assisting with literature reviews
- Providing citation guidance (APA, MLA, IEEE)
Be precise, cite general knowledge only (never fabricate specific paper titles or authors unless given them), and structure longer answers with short headings or bullet points where useful. Keep tone professional and encouraging.`;

const STORAGE_KEY = "ara_chat_history_v1";
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.7;

/* ------------------------------------------------------------
   2. STATE
------------------------------------------------------------- */
let chatHistory = [];        // [{ role, content, ts }]
let isGenerating = false;

/* ------------------------------------------------------------
   3. DOM READY
------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initHeroGraph();
  initChat();
  initExamplePrompts();
  initWorkflowReveal();
  initGenericReveal();
  initCounters();
  initCapabilityBars();
  initFAQ();
  initContactForm();
  checkApiKey();
});

/* ------------------------------------------------------------
   4. NAVIGATION
------------------------------------------------------------- */
function initNav() {
  const navbar = document.getElementById("navbar");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 20);
  });

  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
}

/* ------------------------------------------------------------
   5. HERO — Knowledge graph SVG animation (signature element)
------------------------------------------------------------- */
function initHeroGraph() {
  const svg = document.getElementById("graphCanvas");
  if (!svg) return;

  const W = 480, H = 460;
  const colors = ["#3b82f6", "#8b5cf6", "#22d3ee"];
  const nodeCount = 16;
  const nodes = [];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: 40 + Math.random() * (W - 80),
      y: 40 + Math.random() * (H - 80),
      r: 4 + Math.random() * 5,
      color: colors[i % colors.length],
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
    });
  }

  const nsSVG = "http://www.w3.org/2000/svg";
  const linesGroup = document.createElementNS(nsSVG, "g");
  const nodesGroup = document.createElementNS(nsSVG, "g");
  svg.appendChild(linesGroup);
  svg.appendChild(nodesGroup);

  const nodeEls = nodes.map((n) => {
    const c = document.createElementNS(nsSVG, "circle");
    c.setAttribute("r", n.r);
    c.setAttribute("class", "node");
    c.setAttribute("fill", n.color);
    c.setAttribute("cx", n.x);
    c.setAttribute("cy", n.y);
    nodesGroup.appendChild(c);
    return c;
  });

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function render() {
    linesGroup.innerHTML = "";
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 20 || n.x > W - 20) n.vx *= -1;
      if (n.y < 20 || n.y > H - 20) n.vy *= -1;
      nodeEls[i].setAttribute("cx", n.x);
      nodeEls[i].setAttribute("cy", n.y);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = distance(nodes[i], nodes[j]);
        if (d < 130) {
          const line = document.createElementNS(nsSVG, "line");
          line.setAttribute("x1", nodes[i].x);
          line.setAttribute("y1", nodes[i].y);
          line.setAttribute("x2", nodes[j].x);
          line.setAttribute("y2", nodes[j].y);
          line.setAttribute("stroke", "rgba(255,255,255,0.12)");
          line.setAttribute("stroke-width", 1 - d / 160);
          linesGroup.appendChild(line);
        }
      }
    }
    requestAnimationFrame(render);
  }

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    requestAnimationFrame(render);
  }
}

/* ------------------------------------------------------------
   6. CHAT — Groq API integration
------------------------------------------------------------- */
function initChat() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");
  const messagesEl = document.getElementById("chatMessages");

  loadChatHistory();
  renderMessages();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSend();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  clearBtn.addEventListener("click", () => {
    if (chatHistory.length === 0) return;
    chatHistory = [];
    saveChatHistory();
    renderMessages();
  });

  async function handleSend() {
    const text = input.value.trim();
    if (!text || isGenerating) return;

    if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY") {
      showApiBanner();
      return;
    }

    chatHistory.push({ role: "user", content: text, ts: Date.now() });
    saveChatHistory();
    renderMessages();
    input.value = "";
    input.style.height = "auto";

    isGenerating = true;
    sendBtn.disabled = true;
    renderTypingIndicator(true);

    try {
      const reply = await callGroqAPI(text);
      chatHistory.push({ role: "assistant", content: reply, ts: Date.now() });
    } catch (err) {
      chatHistory.push({
        role: "assistant",
        content: friendlyError(err),
        ts: Date.now(),
        isError: true,
      });
    } finally {
      isGenerating = false;
      sendBtn.disabled = false;
      renderTypingIndicator(false);
      saveChatHistory();
      renderMessages();
    }
  }

  function renderTypingIndicator(show) {
    let el = document.getElementById("typingIndicator");
    if (show) {
      if (el) return;
      el = document.createElement("div");
      el.id = "typingIndicator";
      el.className = "msg assistant";
      el.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid fa-brain"></i></div>
        <div class="msg-body">
          <div class="msg-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>
        </div>`;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (el) {
      el.remove();
    }
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    if (chatHistory.length === 0) {
      messagesEl.innerHTML = `
        <div class="msg assistant">
          <div class="msg-avatar"><i class="fa-solid fa-brain"></i></div>
          <div class="msg-body">
            <div class="msg-bubble">Hi! I'm your AI Research Assistant, powered by Groq. Ask me to explain a concept, suggest a methodology, or draft a citation — try one of the examples on the left.</div>
          </div>
        </div>`;
      return;
    }
    chatHistory.forEach((m, idx) => {
      const wrap = document.createElement("div");
      wrap.className = `msg ${m.role}`;
      const time = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      wrap.innerHTML = `
        <div class="msg-avatar">${m.role === "user" ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-brain"></i>'}</div>
        <div class="msg-body">
          <div class="msg-bubble">${escapeHTML(m.content)}</div>
          <div class="msg-meta">
            <span>${time}</span>
            ${m.role === "assistant" ? `<button data-copy="${idx}" aria-label="Copy response"><i class="fa-regular fa-copy"></i></button>` : ""}
          </div>
        </div>`;
      messagesEl.appendChild(wrap);
    });
    messagesEl.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-copy"));
        navigator.clipboard.writeText(chatHistory[idx].content).then(() => {
          btn.innerHTML = '<i class="fa-solid fa-check"></i>';
          setTimeout(() => (btn.innerHTML = '<i class="fa-regular fa-copy"></i>'), 1500);
        });
      });
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      chatHistory = raw ? JSON.parse(raw) : [];
    } catch {
      chatHistory = [];
    }
  }

  function saveChatHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch {
      /* localStorage unavailable — fail silently, chat still works in-session */
    }
  }
}

/* ------------------------------------------------------------
   7. GROQ API CALL
------------------------------------------------------------- */
async function callGroqAPI(userMessage) {
  const recentHistory = chatHistory.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const payload = {
    model: GROQ_MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recentHistory],
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw { type: "network" };
  }

  if (response.status === 401) throw { type: "auth" };
  if (response.status === 429) throw { type: "rate_limit" };
  if (!response.ok) throw { type: "invalid", status: response.status };

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw { type: "invalid" };
  return content.trim();
}

function friendlyError(err) {
  switch (err?.type) {
    case "auth":
      return "⚠️ Your Groq API key looks invalid or missing. Open script.js and set GROQ_API_KEY to a valid key from console.groq.com.";
    case "rate_limit":
      return "⚠️ Rate limit reached on the Groq API. Please wait a moment and try again.";
    case "network":
      return "⚠️ Network error — check your internet connection and try again.";
    default:
      return "⚠️ Something went wrong processing that request. Please try rephrasing your question.";
  }
}

function showApiBanner() {
  const banner = document.getElementById("apiBanner");
  if (banner) banner.classList.add("show");
}

function checkApiKey() {
  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY") {
    showApiBanner();
    const dot = document.getElementById("statusDot");
    if (dot) dot.classList.remove("ready");
  } else {
    const dot = document.getElementById("statusDot");
    if (dot) dot.classList.add("ready");
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ------------------------------------------------------------
   8. EXAMPLE PROMPTS
------------------------------------------------------------- */
function initExamplePrompts() {
  document.querySelectorAll(".demo-example").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("chatInput");
      input.value = btn.dataset.prompt || btn.textContent.trim();
      input.focus();
      input.dispatchEvent(new Event("input"));
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ------------------------------------------------------------
   9. WORKFLOW TIMELINE REVEAL
------------------------------------------------------------- */
function initWorkflowReveal() {
  const steps = document.querySelectorAll(".workflow-step");
  if (!steps.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("in-view");
      });
    },
    { threshold: 0.3 }
  );
  steps.forEach((s) => io.observe(s));
}

/* ------------------------------------------------------------
   10. GENERIC SCROLL REVEAL
------------------------------------------------------------- */
function initGenericReveal() {
  const items = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------
   11. ANIMATED COUNTERS
------------------------------------------------------------- */
function initCounters() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((c) => io.observe(c));
}

function animateCounter(el) {
  const target = el.dataset.count;
  const numeric = parseFloat(target.replace(/[^\d.]/g, ""));
  const suffix = target.replace(/[\d.]/g, "");
  if (isNaN(numeric)) {
    el.textContent = target;
    return;
  }
  const duration = 1400;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(numeric * eased) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------
   12. CAPABILITY PROGRESS BARS
------------------------------------------------------------- */
function initCapabilityBars() {
  const bars = document.querySelectorAll(".bar-fill");
  if (!bars.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.width = entry.target.dataset.value + "%";
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );
  bars.forEach((b) => io.observe(b));
}

/* ------------------------------------------------------------
   13. FAQ ACCORDION
------------------------------------------------------------- */
function initFAQ() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
}

/* ------------------------------------------------------------
   14. CONTACT FORM VALIDATION
------------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const note = document.getElementById("formNote");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;

    const nameField = form.querySelector("#cf-name").closest(".field");
    const emailField = form.querySelector("#cf-email").closest(".field");
    const messageField = form.querySelector("#cf-message").closest(".field");
    const emailValue = form.querySelector("#cf-email").value.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    [nameField, emailField, messageField].forEach((f) => f.classList.remove("error"));

    if (!form.querySelector("#cf-name").value.trim()) {
      nameField.classList.add("error");
      valid = false;
    }
    if (!emailRe.test(emailValue)) {
      emailField.classList.add("error");
      valid = false;
    }
    if (!form.querySelector("#cf-message").value.trim()) {
      messageField.classList.add("error");
      valid = false;
    }

    if (!valid) {
      note.textContent = "Please fix the highlighted fields.";
      note.classList.add("show");
      return;
    }

    note.textContent = "Message received — this demo form doesn't send data anywhere yet, but wire it to your backend or an email API to go live.";
    note.classList.add("show");
    form.reset();
  });
}