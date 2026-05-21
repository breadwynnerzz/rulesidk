/* Brick City RP docs application.
   Static routing, markdown rendering, sidebar state, and search all live here
   so the site works on GitHub Pages and Cloudflare Pages with no build step. */

const DOCS = [
  {
    title: "Getting Started",
    pages: [
      { slug: "welcome", title: "Welcome To Brick City", icon: "📖", file: "docs/general/welcome.md" },
      { slug: "general-rules", title: "General Rules", icon: "📘", file: "docs/general/general-rules.md" },
      { slug: "reporting-requirements", title: "Reporting Requirements", icon: "🚩", file: "docs/general/reporting-requirements.md" },
      { slug: "tebex-item-loss", title: "Tebex Item Loss", icon: "❌", file: "docs/general/tebex-item-loss.md" }
    ]
  },
  {
    title: "City Guidelines",
    pages: [
      { slug: "roleplay-rules", title: "Roleplay Rules", icon: "🎭", file: "docs/roleplay/roleplay-rules.md" },
      { slug: "green-zone-conduct", title: "Green Zone Conduct", icon: "🟢", file: "docs/roleplay/green-zone-conduct.md" },
      { slug: "interaction-initiation", title: "Interaction/Initiation Guidelines", icon: "⌛", file: "docs/roleplay/interaction-initiation.md" },
      { slug: "criminal-rules", title: "Criminal Rules", icon: "🥷", file: "docs/roleplay/criminal-rules.md" }
    ]
  },
  {
    title: "Gang Rules",
    pages: [
      { slug: "gang-rules", title: "Gang Rules", icon: "⚑", file: "docs/gang/gang-rules.md" }
    ]
  },
  {
    title: "Staff Rules",
    pages: [
      { slug: "staff-rules", title: "Staff Rules", icon: "🛡️", file: "docs/staff/staff-rules.md" },
      { slug: "pd-ems-basics", title: "PD / EMS Conduct", icon: "❓", file: "docs/staff/pd-ems-basics.md" },
      { slug: "pd-rules", title: "PD Rules", icon: "👮", file: "docs/staff/pd-rules.md" },
      { slug: "ems-rules", title: "EMS Rules", icon: "🚑", file: "docs/staff/ems-rules.md" },
      { slug: "weazel-news", title: "Weazel News", icon: "📰", file: "docs/staff/weazel-news.md" }
    ]
  },
  {
    title: "Server Information",
    pages: [
      { slug: "economy-rules", title: "Economy Rules", icon: "💳", file: "docs/economy/economy-rules.md" },
      { slug: "punishments", title: "Punishments", icon: "⚖️", file: "docs/punishments/punishments.md" },
      { slug: "commands", title: "Commands", icon: "⌨", file: "docs/commands/commands.md" },
      { slug: "privacy-policy", title: "Privacy Policy", icon: "🔒", file: "docs/legal/privacy-policy.md" },
      { slug: "terms-of-service", title: "TOS", icon: "📄", file: "docs/legal/terms-of-service.md" }
    ]
  }
];

const flatPages = DOCS.flatMap((section) => section.pages.map((page) => ({ ...page, section: section.title })));
const pageBySlug = new Map(flatPages.map((page) => [page.slug, page]));
const contentEl = document.querySelector("#content");
const footerEl = document.querySelector("#doc-footer");
const navEl = document.querySelector("#sidebar-nav");
const tocEl = document.querySelector("#toc");
const transitionEl = document.querySelector("#page-transition");
const progressEl = document.querySelector("#doc-progress");
const sidebarFilter = document.querySelector("#sidebar-filter");
const searchModal = document.querySelector("#search-modal");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");

const markdownCache = new Map();
let currentSlug = "";
let currentHeadings = [];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z0-9#]+;/gi, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headings = [];
  let paragraph = [];
  let list = null;
  let code = null;
  let table = [];

  const closeParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  const closeTable = () => {
    if (!table.length) return;
    const rows = table.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    const [header, divider, ...body] = rows;
    if (header && divider && divider.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      html.push(
        `<table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      );
    } else {
      table.forEach((line) => paragraph.push(line));
      closeParagraph();
    }
    table = [];
  };

  const closeBlocks = () => {
    closeParagraph();
    closeList();
    closeTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (code) {
      if (line.startsWith("```")) {
        html.push(`<pre><code class="language-${escapeHtml(code.lang)}">${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      closeBlocks();
      code = { lang: line.slice(3).trim(), lines: [] };
      continue;
    }

    if (!line.trim()) {
      closeBlocks();
      continue;
    }

    if (/^\|.+\|$/.test(line)) {
      closeParagraph();
      closeList();
      table.push(line);
      continue;
    }

    if (table.length) closeTable();

    const alertMatch = line.match(/^:::(info|warning|danger|success)\s*(.*)$/);
    if (alertMatch) {
      closeBlocks();
      const type = alertMatch[1];
      const body = alertMatch[2] || type;
      html.push(`<div class="markdown-alert ${type}">${inlineMarkdown(body)}</div>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeBlocks();
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/\s+#*$/, "");
      const id = slugify(text);
      headings.push({ id, text, level });
      html.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      closeBlocks();
      html.push("<hr>");
      continue;
    }

    if (line.startsWith("> ")) {
      closeBlocks();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      closeParagraph();
      const type = unordered ? "ul" : "ol";
      if (!list || list.type !== type) closeList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  closeBlocks();
  return { html: html.join("\n"), headings };
}

function renderSidebar(filter = "") {
  const query = filter.trim().toLowerCase();
  navEl.innerHTML = DOCS.map((section) => {
    const pages = section.pages.filter((page) => {
      return !query || page.title.toLowerCase().includes(query) || section.title.toLowerCase().includes(query);
    });
    if (!pages.length) return "";
    return `
      <details class="nav-section" open>
        <summary>${section.title}</summary>
        ${pages.map((page) => `
          <a class="nav-link ${page.slug === currentSlug ? "active" : ""}" href="#/${page.slug}" data-slug="${page.slug}">
            <span class="nav-icon">${page.icon}</span>
            <span>${page.title}</span>
          </a>
        `).join("")}
      </details>
    `;
  }).join("");
}

function renderToc(headings) {
  const items = headings.filter((heading) => heading.level > 1 && heading.level < 4);
  tocEl.innerHTML = items.length
    ? items.map((heading) => `<a href="#/${currentSlug}#${heading.id}" data-toc="${heading.id}">${heading.text}</a>`).join("")
    : '<span class="empty-state">No page sections</span>';
}

function renderFooter(page) {
  const index = flatPages.findIndex((item) => item.slug === page.slug);
  const previous = flatPages[index - 1];
  const next = flatPages[index + 1];
  footerEl.innerHTML = `
    ${previous ? `<a class="pager-link previous" href="#/${previous.slug}"><small>Previous</small>${previous.title}</a>` : "<span></span>"}
    ${next ? `<a class="pager-link next" href="#/${next.slug}"><small>Next</small>${next.title}</a>` : "<span></span>"}
  `;
}

function scrollToAnchor(anchor) {
  const anchorEl = anchor ? document.getElementById(anchor) : null;
  if (!anchorEl) return false;
  const topbarOffset = document.querySelector(".topbar")?.offsetHeight || 0;
  const targetTop = anchorEl.getBoundingClientRect().top + window.scrollY - topbarOffset - 22;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  return true;
}

async function getMarkdown(page) {
  if (markdownCache.has(page.slug)) return markdownCache.get(page.slug);
  const response = await fetch(page.file, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${page.file}`);
  const markdown = await response.text();
  markdownCache.set(page.slug, markdown);
  return markdown;
}

function routeParts() {
  const withoutPrefix = location.hash.replace(/^#\/?/, "") || "welcome";
  const [slug, anchor] = withoutPrefix.split("#");
  return { slug, anchor };
}

async function loadPage(slug = "welcome", anchor = "") {
  const page = pageBySlug.get(slug) || pageBySlug.get("welcome");
  currentSlug = page.slug;
  document.title = `${page.title} | Brick City RP Rules`;
  renderSidebar(sidebarFilter.value);
  transitionEl.style.animation = "none";
  transitionEl.offsetHeight;
  transitionEl.style.animation = "";
  contentEl.innerHTML = '<p class="empty-state">Loading documentation...</p>';

  try {
    const markdown = await getMarkdown(page);
    const rendered = renderMarkdown(markdown);
    currentHeadings = rendered.headings;
    contentEl.innerHTML = rendered.html;
    renderToc(currentHeadings);
    renderFooter(page);
    if (!scrollToAnchor(anchor)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (error) {
    contentEl.innerHTML = `<div class="markdown-alert danger">This page could not be loaded. Check the docs file path and try again.</div>`;
    console.error(error);
  }
}

function currentRoute() {
  return routeParts().slug;
}

function closeMobileSidebar() {
  document.body.classList.remove("sidebar-open");
  document.querySelector("#sidebar-scrim").hidden = true;
}

function openSearch() {
  searchModal.hidden = false;
  searchInput.value = "";
  renderSearchResults("");
  requestAnimationFrame(() => searchInput.focus());
}

function closeSearch() {
  searchModal.hidden = true;
}

function pageSummary(markdown) {
  return markdown
    .replace(/[#>*_`|:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

async function renderSearchResults(query) {
  const normalized = query.trim().toLowerCase();
  const entries = await Promise.all(flatPages.map(async (page) => {
    const markdown = await getMarkdown(page).catch(() => "");
    const haystack = `${page.title} ${page.section} ${markdown}`.toLowerCase();
    return { page, markdown, matches: !normalized || haystack.includes(normalized) };
  }));

  const matches = entries.filter((entry) => entry.matches).slice(0, 12);
  searchResults.innerHTML = matches.length
    ? matches.map(({ page, markdown }) => `
      <a class="search-result" href="#/${page.slug}" data-search-hit>
        <strong>${page.icon} ${page.title}</strong>
        <span>${page.section} - ${escapeHtml(pageSummary(markdown))}</span>
      </a>
    `).join("")
    : '<p class="empty-state">No matching rules found.</p>';
}

function updateProgress() {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const percent = height > 0 ? (window.scrollY / height) * 100 : 0;
  progressEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function updateActiveToc() {
  const visible = currentHeadings
    .filter((heading) => heading.level > 1)
    .map((heading) => document.getElementById(heading.id))
    .filter(Boolean)
    .reverse()
    .find((element) => element.getBoundingClientRect().top < 130);
  document.querySelectorAll("[data-toc]").forEach((link) => {
    link.classList.toggle("active", visible && link.dataset.toc === visible.id);
  });
}

renderSidebar();
loadPage(routeParts().slug, routeParts().anchor);

window.addEventListener("hashchange", () => {
  closeSearch();
  closeMobileSidebar();
  const route = routeParts();
  if (route.slug === currentSlug && route.anchor) {
    scrollToAnchor(route.anchor);
    return;
  }
  loadPage(route.slug, route.anchor);
});

tocEl.addEventListener("click", (event) => {
  const link = event.target.closest("[data-toc]");
  if (!link) return;
  event.preventDefault();
  history.pushState(null, "", link.getAttribute("href"));
  scrollToAnchor(link.dataset.toc);
  updateActiveToc();
});

window.addEventListener("scroll", () => {
  updateProgress();
  updateActiveToc();
}, { passive: true });

sidebarFilter.addEventListener("input", (event) => renderSidebar(event.target.value));

document.querySelector("#menu-toggle").addEventListener("click", () => {
  document.body.classList.add("sidebar-open");
  document.querySelector("#sidebar-scrim").hidden = false;
});

document.querySelector("#sidebar-scrim").addEventListener("click", closeMobileSidebar);
document.querySelector("#search-trigger").addEventListener("click", openSearch);
document.querySelectorAll("[data-close-search]").forEach((button) => button.addEventListener("click", closeSearch));
searchInput.addEventListener("input", (event) => renderSearchResults(event.target.value));

searchResults.addEventListener("click", (event) => {
  if (event.target.closest("[data-search-hit]")) closeSearch();
});

document.addEventListener("keydown", (event) => {
  const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
  if (isSearchShortcut) {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    closeSearch();
    closeMobileSidebar();
  }
});
