// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// theme toggle
const themeToggleBtn = document.querySelector("[data-theme-toggle]");

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);

  const icon = themeToggleBtn?.querySelector("ion-icon");
  if (icon) icon.setAttribute("name", t === "light" ? "sunny-outline" : "moon-outline");
}

if (themeToggleBtn) {
  const storedTheme = localStorage.getItem("theme");
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(storedTheme || (prefersLight ? "light" : "dark"));

  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem("theme", next);
    applyTheme(next);
  });
}

// add event to all nav link
navigationLinks.forEach((link, index) => {
  link.addEventListener("click", () => {

    // remove active from all
    pages.forEach(page => page.classList.remove("active"));
    navigationLinks.forEach(nav => nav.classList.remove("active"));

    // add active to clicked
    pages[index].classList.add("active");
    link.classList.add("active");

    window.scrollTo(0, 0);

    // Manage AskMe showcase based on active page.
    const pageName = String(pages[index]?.dataset?.page || "").trim().toLowerCase();
    if (pageName === "askme") {
      startAskmeShowcase();
    } else {
      stopAskmeShowcase();
      const bot = getAskmeBot();
      if (bot) bot.dataset.expression = "idle";
    }
  });
});

// If you hover any navbar link while AskMe is active (except AskMe itself), the bot gets sad/cry briefly.
navigationLinks.forEach((link) => {
  link.addEventListener("mouseenter", () => {
    if (!isAskMeActive()) return;
    const label = String(link.textContent || "").trim().toLowerCase();
    if (label === "askme") return;

    const bot = getAskmeBot();
    if (!bot) return;
    if (bot.dataset.expression === "thinking" || bot.dataset.expression === "inspect") return;
    setAskmeBotExpression("cry", { ttlMs: 5000 });
  });
});

const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

const getAskmeBot = () => {
  return document.querySelector("[data-page=askme] .askme-bot");
};

const installAskmeBotAngryClick = () => {
  const bot = getAskmeBot();
  if (!bot) return;
  if (bot.dataset.angryClickInstalled === "1") return;
  bot.dataset.angryClickInstalled = "1";

  bot.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    stopAskmeShowcase();

    if (bot._exprTimer) {
      clearTimeout(bot._exprTimer);
      bot._exprTimer = null;
    }

    if (bot._jumpingTimer) {
      clearTimeout(bot._jumpingTimer);
      bot._jumpingTimer = null;
    }

    delete bot.dataset.jumping;
    startAskmeAngryAvoid(4000);
  });
};

const startAskmeAngryAvoid = (durationMs = 3500) => {
  const bot = getAskmeBot();
  if (!bot) return;
  const card = bot.closest(".chatbot-card");
  if (!card) return;

  const prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (bot._angryTimer) {
    clearTimeout(bot._angryTimer);
    bot._angryTimer = null;
  }

  bot.dataset.angry = "1";
  bot.dataset.expression = "angry";

  let last = null;
  let raf = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

  const step = () => {
    raf = 0;
    if (!last) return;
    if (!isAskMeActive()) return;

    const cardRect = card.getBoundingClientRect();
    const botRect = bot.getBoundingClientRect();

    const botW = botRect.width || 86;
    const botH = botRect.height || 86;

    const botCx = (botRect.left - cardRect.left) + botW / 2;
    const botCy = (botRect.top - cardRect.top) + botH / 2;
    const mx = last.x - cardRect.left;
    const my = last.y - cardRect.top;

    const dx = botCx - mx;
    const dy = botCy - my;
    const dist = Math.max(1, Math.hypot(dx, dy));

    // If cursor is close, move away more aggressively.
    const danger = dist < 140 ? 1 : 0.35;
    const baseStep = prefersReduce ? 10 : 18;
    const stepPx = baseStep * danger;

    const ux = dx / dist;
    const uy = dy / dist;

    let x = parseFloat(bot.dataset.x || 14);
    let y = parseFloat(bot.dataset.y || 14);

    x += ux * stepPx;
    y += uy * stepPx;

    const pad = 8;
    x = clamp(x, pad, cardRect.width - botW - pad);
    y = clamp(y, pad, cardRect.height - botH - pad);

    bot.style.setProperty("--bot-x", `${Math.round(x)}px`);
    bot.style.setProperty("--bot-y", `${Math.round(y)}px`);
    bot.dataset.x = String(Math.round(x));
    bot.dataset.y = String(Math.round(y));
  };

  const onMove = (e) => {
    last = { x: e.clientX, y: e.clientY };
    if (!raf) raf = window.requestAnimationFrame(step);
  };

  // Capture pointer movement over the whole card while angry.
  card.addEventListener("mousemove", onMove);

  bot._angryTimer = setTimeout(() => {
    card.removeEventListener("mousemove", onMove);
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    last = null;

    delete bot.dataset.angry;
    bot.dataset.expression = "idle";

    // Return to default placement (right of title) after running away.
    positionAskmeBotByTitle();
    if (isAskMeActive()) startAskmeShowcase();
    bot._angryTimer = null;
  }, Math.max(800, durationMs));
};

const setAskmeBotExpression = (expr, opts = {}) => {
  const bot = getAskmeBot();
  if (!bot) return;

  if (bot.dataset.angry === "1" && expr !== "angry") return;

  const prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bot.dataset.expression = String(expr || "idle");

  if (prefersReduce) return;

  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 1200;
  if (ttl > 0) {
    if (bot._exprTimer) clearTimeout(bot._exprTimer);
    bot._exprTimer = setTimeout(() => {
      // Don't override thinking state
      if (bot.dataset.expression !== "thinking") bot.dataset.expression = "idle";
    }, ttl);
  }
};

const triggerAskmeBotJumping = (durationMs = 2000) => {
  const bot = getAskmeBot();
  if (!bot) return;

  if (bot._jumpingTimer) {
    clearTimeout(bot._jumpingTimer);
    bot._jumpingTimer = null;
  }

  bot.dataset.jumping = "1";
  bot._jumpingTimer = setTimeout(() => {
    // Only stop jumping if still on AskMe
    const stillAskMe = isAskMeActive();
    if (stillAskMe) delete bot.dataset.jumping;
    bot._jumpingTimer = null;
  }, Math.max(0, durationMs));
};

const isAskMeActive = () => {
  const askme = document.querySelector('[data-page="askme"]');
  return !!askme?.classList?.contains("active");
};

const positionAskmeBotByTitle = () => {
  const bot = getAskmeBot();
  if (!bot) return;

  const article = bot.closest('[data-page="askme"]');
  const card = bot.closest('.chatbot-card');
  const title = article?.querySelector('header .article-title');
  if (!article || !card || !title) return;

  const cardRect = card.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const botRect = bot.getBoundingClientRect();

  const botW = botRect.width || 86;
  const botH = botRect.height || 86;

  // Desired position: to the right of the AskMe title, vertically centered with it.
  const pad = 10;
  let x = (titleRect.right - cardRect.left) + pad;
  let y = (titleRect.top - cardRect.top) + (titleRect.height / 2) - (botH / 2);

  // Clamp within the card width so it never overlaps outside.
  x = Math.max(pad, Math.min(x, cardRect.width - botW - pad));

  // Allow it to sit a bit above the card (negative y) but not too far.
  const minY = -Math.round(botH * 0.9);
  const maxY = Math.round(titleRect.bottom - cardRect.top);
  y = Math.max(minY, Math.min(y, maxY));

  bot.style.setProperty('--bot-x', `${Math.round(x)}px`);
  bot.style.setProperty('--bot-y', `${Math.round(y)}px`);
  bot.dataset.x = String(Math.round(x));
  bot.dataset.y = String(Math.round(y));
};

const stopAskmeShowcase = () => {
  const bot = getAskmeBot();
  if (bot && bot._showcaseTimer) {
    clearInterval(bot._showcaseTimer);
    bot._showcaseTimer = null;
  }
};

const startAskmeShowcase = () => {
  const bot = getAskmeBot();
  if (!bot) return;

  if (bot.dataset.angry === "1") return;

  // Ensure the bot starts to the right of the AskMe title.
  positionAskmeBotByTitle();

  stopAskmeShowcase();

  const prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduce) {
    setAskmeBotExpression("smile", { ttlMs: 0 });
    return;
  }

  // Start with a warm smile, then laugh in a loop while AskMe is active.
  const sequence = [
    { expr: "smile", ms: 1400 },
    { expr: "laugh", ms: 1600 },
  ];
  let i = 0;

  const step = () => {
    if (!isAskMeActive()) return;
    const current = bot.dataset.expression;
    if (current === "thinking" || current === "inspect") return;

    const s = sequence[i % sequence.length];
    bot.dataset.expression = s.expr;
    i += 1;
  };

  step();
  bot._showcaseTimer = setInterval(step, 1600);
};

// Keep the default bot placement responsive.
let _askmeBotResizeTimer = null;
window.addEventListener('resize', () => {
  if (!isAskMeActive()) return;
  if (_askmeBotResizeTimer) window.clearTimeout(_askmeBotResizeTimer);
  _askmeBotResizeTimer = window.setTimeout(() => {
    positionAskmeBotByTitle();
  }, 120);
});

// Default expression
setAskmeBotExpression("idle", { ttlMs: 0 });

const installAskmeTypingInspect = (inputEl) => {
  if (!inputEl) return;

  let stopTimer = null;
  const stopDelayMs = 900;

  const scheduleStop = () => {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      const bot = getAskmeBot();
      if (!bot) return;
      if (bot.dataset.expression === "thinking") return;
      if (document.activeElement === inputEl && (inputEl.value || "").trim().length > 0) return;
      setAskmeBotExpression("idle", { ttlMs: 0 });
    }, stopDelayMs);
  };

  inputEl.addEventListener("focus", () => {
    const bot = getAskmeBot();
    if (bot && bot.dataset.expression !== "thinking") {
      setAskmeBotExpression("inspect", { ttlMs: 0 });
    }
  });

  inputEl.addEventListener("input", () => {
    const bot = getAskmeBot();
    if (!bot) return;
    if (bot.dataset.expression !== "thinking") {
      setAskmeBotExpression("inspect", { ttlMs: 0 });
    }
    scheduleStop();
  });

  inputEl.addEventListener("blur", () => {
    scheduleStop();
  });
};

const navigateToPage = (pageName) => {
  const target = String(pageName || "").trim().toLowerCase();
  if (!target) return;

  pages.forEach((page) => {
    page.classList.toggle("active", String(page.dataset.page || "").trim().toLowerCase() === target);
  });

  navigationLinks.forEach((nav) => {
    nav.classList.toggle("active", String(nav.textContent || "").trim().toLowerCase() === target);
  });

  window.scrollTo(0, 0);
};

if (sidebarBtn && sidebar) {
  sidebarBtn.addEventListener("click", () => {
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 460px)").matches;
    if (isMobile) {
      sidebar.classList.remove("active");
      navigateToPage("contact");
      return;
    }

    sidebar.classList.toggle("active");
  });
}

const chatbotForm = document.querySelector("[data-chatbot-form]");
const chatbotInput = document.querySelector("[data-chatbot-input]");

installAskmeTypingInspect(chatbotInput);
installAskmeBotAngryClick();

const quickPrompts = {
  // Core Info
  intro: "Give me a quick introduction about yourself",
  skills: "What are your key technical skills?",
  techStack: "What technologies and tools do you use?",

  // Projects (HIGH VALUE 🔥)
  projects: "Show your top projects with brief explanations",
  bestProject: "Which is your best project and why?",
  projectDetails: "Explain one of your projects in detail with impact and tech used",

  // Experience & Goals
  experience: "What practical experience do you have?",
  learning: "How do you approach learning new technologies?",
  goals: "What are your short-term and long-term career goals?",

  // Problem Solving & Thinking
  problemSolving: "How do you approach solving a new problem?",
  strengths: "What are your key strengths as a developer?",

  // Specializations
  dataScience: "What is your experience in Data Science and Machine Learning?",
  nlp: "Have you worked on NLP or real-time data projects?",
  dashboard: "Tell me about your Power BI dashboard project",

  // Availability & Hiring
  availability: "Are you available for internships or opportunities?",
  hire: "Why should someone hire you?",

  // Contact
  contact: "How can I contact you? Include LinkedIn and GitHub links",
};

function linkifyText(text) {
  const sanitizeBotText = (raw) => {
    let s = String(raw || "");

    // If the model ever returns HTML anchors/fragments, strip them and keep only readable text.
    // Full anchors -> keep inner text
    s = s.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");
    // Any remaining opening/closing tags
    s = s.replace(/<\/?a\b[^>]*>/gi, "");
    // Common leaked attribute fragments
    s = s.replace(/\s*target\s*=\s*"_blank"/gi, "");
    s = s.replace(/\s*rel\s*=\s*"[^"]*"/gi, "");
    s = s.replace(/\s*href\s*=\s*"/gi, "");
    s = s.replace(/\s*>\s*/g, " ");
    s = s.replace(/&quot;/gi, '"');

    return s;
  };

  const escapeHtml = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let escaped = escapeHtml(sanitizeBotText(text).replace(/\r\n/g, "\n"));

  escaped = escaped.replace(/^\s*[\*\-]\s+/gm, "• ");

  escaped = escaped.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");

  escaped = escaped.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  const withLinks = escaped
    .replace(/(?<!href=\")\b(https?:\/\/[^\s<]+)\b/g, (m) => {
      return `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`;
    })
    .replace(/\b(linkedin\.com\/[\w\-./?=&%]+)\b/g, (m) => {
      const href = `https://${m}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>`;
    })
    .replace(/\b(github\.com\/[\w\-./?=&%]+)\b/g, (m) => {
      const href = `https://${m}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>`;
    })
    .replace(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, (m) => {
      return `<a href="mailto:${m}">${m}</a>`;
    });

  return withLinks.replace(/\n/g, "<br>");
}

function typeEffect(text, element, speed = 20) {
  let i = 0;
  element.textContent = "";
  function typing() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(typing, speed);
    } else {
      element.innerHTML = linkifyText(element.textContent);
    }
  }
  typing();
}

function addMessage(text, sender) {
  const chat = document.querySelector(".chat-box");
  if (!chat) return;

  const msg = document.createElement("div");
  msg.className = sender === "user" ? "user-msg" : "bot-msg";
  chat.appendChild(msg);

  if (sender === "bot") {
    typeEffect(text, msg);
  } else {
    msg.innerText = text;
  }

  chat.scrollTop = chat.scrollHeight;
}

async function fetchBotReply(message) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Request failed");
  }

  const data = await res.json();
  return data?.reply || "Sorry, I couldn't generate a response.";
}

function quickAsk(type) {
  const prompt = quickPrompts[type] || type;
  if (!prompt) return;

  setAskmeBotExpression("excited", { ttlMs: 900 });
  triggerAskmeBotJumping(2000);
  addMessage(prompt, "user");
  const placeholder = document.createElement("div");
  placeholder.className = "bot-msg";
  placeholder.textContent = "Typing...";
  const chat = document.querySelector(".chat-box");
  if (chat) {
    chat.appendChild(placeholder);
    chat.scrollTop = chat.scrollHeight;
  }

  (async () => {
    try {
      setAskmeBotExpression("thinking", { ttlMs: 0 });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: prompt }),
      });

      const data = await res.json();
      const reply = data?.reply || "Sorry, I couldn't generate a response.";
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      addMessage(reply, "bot");
      setAskmeBotExpression("happy", { ttlMs: 1400 });
    } catch {
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      addMessage("Sorry, the chatbot is unavailable right now. Please try again in a moment.", "bot");
      setAskmeBotExpression("surprised", { ttlMs: 1400 });
    }
  })();
}

window.quickAsk = quickAsk;

const moveAskmeBotToButton = (btn) => {
  const card = btn?.closest(".chatbot-card");
  if (!card) return;

  const bot = card.querySelector(".askme-bot");
  if (!bot) return;

  const getCurrentBotXY = () => {
    // Prefer computed transform (handles mid-animation positions) and fall back to stored dataset.
    const cs = window.getComputedStyle(bot);
    const tf = cs.transform;
    if (tf && tf !== "none") {
      // matrix(a,b,c,d,tx,ty) or matrix3d(..., tx, ty, tz)
      const m2 = tf.match(/^matrix\(([^)]+)\)$/);
      if (m2) {
        const parts = m2[1].split(",").map((v) => parseFloat(v.trim()));
        if (parts.length === 6 && Number.isFinite(parts[4]) && Number.isFinite(parts[5])) {
          return { x: parts[4], y: parts[5] };
        }
      }
      const m3 = tf.match(/^matrix3d\(([^)]+)\)$/);
      if (m3) {
        const parts = m3[1].split(",").map((v) => parseFloat(v.trim()));
        // matrix3d indices: tx=12, ty=13
        if (parts.length === 16 && Number.isFinite(parts[12]) && Number.isFinite(parts[13])) {
          return { x: parts[12], y: parts[13] };
        }
      }
    }

    const x = parseFloat(bot.dataset.x || 14);
    const y = parseFloat(bot.dataset.y || 14);
    return { x, y };
  };

  // Cancel any in-flight jump animation so the bot never gets stuck mid-way.
  if (bot._askmeJumpAnim) {
    try {
      bot._askmeJumpAnim.cancel();
    } catch {
      // ignore
    }
    bot._askmeJumpAnim = null;
  }

  const prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardRect = card.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const botRect = bot.getBoundingClientRect();

  const botW = botRect.width || 86;
  const botH = botRect.height || 86;

  // Target: centered on button, sitting slightly above it.
  let targetX = btnRect.left - cardRect.left + btnRect.width / 2 - botW / 2;
  const gapAboveButton = 18;
  let targetY = btnRect.top - cardRect.top - botH - gapAboveButton;

  // Keep within card bounds.
  const pad = 6;
  targetX = Math.max(pad, Math.min(targetX, cardRect.width - botW - pad));
  // Allow the bot to sit slightly above the card (negative Y) so it doesn't cover the button.
  const minY = -Math.round(botH * 0.55);
  targetY = Math.max(minY, Math.min(targetY, cardRect.height - botH - pad));

  const current = getCurrentBotXY();
  const currentX = current.x;
  const currentY = current.y;

  bot.dataset.x = String(targetX);
  bot.dataset.y = String(targetY);

  // Freeze starting position into CSS vars so the jump always starts from the real current spot.
  bot.style.setProperty("--bot-x", `${currentX}px`);
  bot.style.setProperty("--bot-y", `${currentY}px`);

  if (prefersReduce) {
    bot.style.setProperty("--bot-x", `${targetX}px`);
    bot.style.setProperty("--bot-y", `${targetY}px`);
    return;
  }

  const peakY = Math.min(currentY, targetY) - 32;
  const keyframes = [
    { transform: `translate3d(${currentX}px, ${currentY}px, 0)` },
    { transform: `translate3d(${(currentX + targetX) / 2}px, ${peakY}px, 0)` },
    { transform: `translate3d(${targetX}px, ${targetY}px, 0)` },
  ];

  const anim = bot.animate(keyframes, {
    duration: 520,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fill: "forwards",
  });

  bot._askmeJumpAnim = anim;

  const commit = () => {
    bot.style.setProperty("--bot-x", `${targetX}px`);
    bot.style.setProperty("--bot-y", `${targetY}px`);
    bot._askmeJumpAnim = null;
  };

  anim.onfinish = commit;
  anim.oncancel = commit;

  // Safety: some browsers may skip finish events in edge cases (e.g., rapid clicks/background tabs).
  setTimeout(() => {
    if (bot._askmeJumpAnim === anim) commit();
  }, 650);
};

// Make the AskMe bot jump to the quick action you click.
document.addEventListener(
  "click",
  (e) => {
    const btn = e.target?.closest?.(".quick-actions button");
    if (!btn) return;
    if (btn.classList.contains("quick-actions-clear")) return;
    moveAskmeBotToButton(btn);
  },
  true
);

function clearChat() {
  const chat = document.querySelector(".chat-box");
  if (!chat) return;
  chat.innerHTML = "";
  addMessage("Hi! Ask me anything about my portfolio, projects, skills, or availability.", "bot");
}

window.clearChat = clearChat;

addMessage("Hi! Ask me anything about my portfolio, projects, skills, or availability.", "bot");

if (chatbotForm && chatbotInput) {
  chatbotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = chatbotInput.value.trim();
    if (!input) return;
    setAskmeBotExpression("excited", { ttlMs: 900 });
    triggerAskmeBotJumping(2000);
    addMessage(input, "user");
    chatbotInput.value = "";

    const placeholder = document.createElement("div");
    placeholder.className = "bot-msg";
    placeholder.textContent = "Typing...";
    const chat = document.querySelector(".chat-box");
    if (chat) {
      chat.appendChild(placeholder);
      chat.scrollTop = chat.scrollHeight;
    }

    try {
      setAskmeBotExpression("thinking", { ttlMs: 0 });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();
      const reply = data?.reply || "Sorry, I couldn't generate a response.";
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      addMessage(reply, "bot");
      setAskmeBotExpression("happy", { ttlMs: 1400 });
    } catch {
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      addMessage("Sorry, the chatbot is unavailable right now. Please try again in a moment.", "bot");
      setAskmeBotExpression("surprised", { ttlMs: 1400 });
    }
  });
}

// contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");
const formStatus = document.querySelector("[data-form-status]");

// add event to all form input field
if (form && formInputs.length > 0 && formBtn) {
  formInputs.forEach((input) => {
    input.addEventListener("input", function () {
      // check form validation
      if (form.checkValidity()) {
        formBtn.removeAttribute("disabled");
      } else {
        formBtn.setAttribute("disabled", "");
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const action = form.getAttribute("action");
    if (!action) return;

    if (formStatus) {
      formStatus.textContent = "Sending...";
      formStatus.classList.remove("success", "error");
    }

    formBtn.setAttribute("disabled", "");

    try {
      const formData = new FormData(form);
      const res = await fetch(action, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        form.reset();
        if (formStatus) {
          formStatus.textContent = "Message sent successfully.";
          formStatus.classList.add("success");
        }
      } else {
        if (formStatus) {
          formStatus.textContent = "Failed to send message. Please try again.";
          formStatus.classList.add("error");
        }
      }
    } catch (err) {
      if (formStatus) {
        formStatus.textContent = "Network error. Please check your connection and try again.";
        formStatus.classList.add("error");
      }
    }
  });
}

// certificate lightbox
const certLightbox = document.querySelector("[data-cert-lightbox]");
const certLightboxImg = document.querySelector("[data-cert-lightbox-img]");
const certLightboxSource = document.querySelector("[data-cert-lightbox-source]");
const certLightboxCloseEls = document.querySelectorAll("[data-cert-lightbox-close]");
const certificateCards = document.querySelectorAll(".certificate-card");

const openCertLightbox = (src, alt, sourceUrl) => {
  if (!certLightbox || !certLightboxImg || !src) return;

  certLightboxImg.src = src;
  certLightboxImg.alt = alt || "Certificate";

  if (certLightboxSource) {
    if (sourceUrl) {
      certLightboxSource.href = sourceUrl;
      certLightboxSource.style.display = "inline-flex";
    } else {
      certLightboxSource.href = "";
      certLightboxSource.style.display = "none";
    }
  }

  certLightbox.classList.add("active");
  document.body.style.overflow = "hidden";
};

const closeCertLightbox = () => {
  if (!certLightbox || !certLightboxImg) return;

  certLightbox.classList.remove("active");
  certLightboxImg.src = "";
  certLightboxImg.alt = "";

  if (certLightboxSource) {
    certLightboxSource.href = "";
    certLightboxSource.style.display = "none";
  }

  document.body.style.overflow = "";
};

if (certLightbox && certificateCards.length > 0) {
  certificateCards.forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    const img = card.querySelector("img");
    if (!img) return;

    const getSourceUrl = () => {
      const dataUrl = card.getAttribute("data-cert-url");
      if (dataUrl) return dataUrl;

      if (card.tagName === "A") {
        const href = card.getAttribute("href");
        if (href && href !== "#") return href;
      }

      return "";
    };

    const openFromImg = () =>
      openCertLightbox(img.getAttribute("src"), img.getAttribute("alt"), getSourceUrl());

    card.addEventListener("click", (e) => {
      if (card.tagName === "A") e.preventDefault();
      openFromImg();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFromImg();
      }
    });
  });

  certLightboxCloseEls.forEach((el) => {
    el.addEventListener("click", closeCertLightbox);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && certLightbox.classList.contains("active")) {
      closeCertLightbox();
    }
  });
}



// project filter variables
const filterItems = document.querySelectorAll("[data-filter-item]");
const filterBtns = document.querySelectorAll("[data-filter-btn]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-select-value]");
const filterSelect = document.querySelector("[data-select]");

// filter function
const filterFunc = (selectedValue) => {
  filterItems.forEach((item) => {
    const category = item.dataset.category.toLowerCase();
    if (selectedValue === "all" || selectedValue === category) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
};

// add event to filter buttons (desktop)
filterBtns.forEach((btn) => {
  btn.addEventListener("click", function () {
    const selectedValue = (this.dataset.filterValue || this.textContent).toLowerCase().trim();

    // update active state on buttons
    filterBtns.forEach(b => b.classList.remove("active"));
    this.classList.add("active");

    filterFunc(selectedValue);
  });
});

// toggle mobile select dropdown
if (filterSelect) {
  filterSelect.addEventListener("click", function () {
    this.classList.toggle("active");
  });
}

// add event to mobile select items
selectItems.forEach((item) => {
  item.addEventListener("click", function () {
    const selectedValue = (this.dataset.filterValue || this.textContent).toLowerCase().trim();
    if (selectValue) selectValue.textContent = this.textContent;
    if (filterSelect) filterSelect.classList.remove("active");
    filterFunc(selectedValue);
  });
});

const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let skillsAnimated = false;

const setSkillBarsToZero = () => {
  const fills = document.querySelectorAll(".skill-progress-fill");
  fills.forEach((fill) => {
    const target = (fill.style.width || "0%").trim();
    if (!fill.dataset.targetWidth) fill.dataset.targetWidth = target;
    fill.style.width = "0%";
  });
};

const animateSkillBars = () => {
  if (skillsAnimated) return;

  const fills = document.querySelectorAll(".skill-progress-fill");
  if (fills.length === 0) return;

  skillsAnimated = true;
  const applyTargets = () => {
    fills.forEach((fill) => {
      const target = (fill.dataset.targetWidth || fill.style.width || "0%").trim();
      fill.style.width = target;
    });
  };

  if (prefersReducedMotion) {
    applyTargets();
    return;
  }

  requestAnimationFrame(applyTargets);
};

if (!prefersReducedMotion) setSkillBarsToZero();

const skillsSection = document.querySelector(".skill");
if (skillsSection && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateSkillBars();
        }
      });
    },
    { threshold: 0.25 }
  );
  observer.observe(skillsSection);
}

navigationLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (link.textContent && link.textContent.trim().toLowerCase() === "skills") {
      setTimeout(animateSkillBars, 50);
    }
  });
});

// certificates tabs (Training / Achievements / Certificates)
const certTabButtons = document.querySelectorAll("[data-cert-tab]");
const certPanels = document.querySelectorAll("[data-cert-panel]");

if (certTabButtons.length > 0 && certPanels.length > 0) {
  certTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.certTab;
      if (!tab) return;

      certTabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      certPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.certPanel === tab);
      });
    });
  });
}