const SETS = {
  main: { title: "Main City Rules", eyebrow: "Citywide standards", intro: "Citywide rules for everyone.", headings: ["Start Here — Brick City RP Server Rules", "General Rules — Clipping System / Reports / Tickets", "Main Rules", "RDM / VDM / NLR", "Metagaming / Powergaming", "Greenzones / Third-Party Mods", "OOC / TOS / Other"] },
  interaction: { title: "Faction / Interaction Rules", eyebrow: "Faction and player interactions", intro: "Rules for faction, civilian, and police interactions.", headings: ["Initiation", "Fear RP / Fail RP", "Faction Association Rules"] },
  emergency: { title: "Emergency Services Rules", eyebrow: "Government services", intro: "Rules for hired police and EMS personnel.", headings: ["Government Job Rules"] }
};

const splitCriminal = new Map([
  ["Robbing & Scamming", "interaction"], ["Kidnappings and Hostages", "interaction"], ["Combat and Scene Involvement", "interaction"],
  ["Character Separation", "main"], ["Combat Logging", "main"], ["Exploiting", "main"]
]);
const splitGov = new Map([["Interaction With Police & EMS", "interaction"], ["Microphone Rules", "main"]]);
const emergencyGroups = new Map([
  ["Department Conduct and Integrity", "Department-Wide Rules"],
  ["Off-Duty Conduct", "Department-Wide Rules"],
  ["Department Property", "Department-Wide Rules"],
  ["PD Searches and Warrants", "Police Department Rules"],
  ["Evidence, Confiscation, and Vehicle Seizure", "Police Department Rules"],
  ["Charges, Sentencing, and Evidence", "Police Department Rules"],
  ["Detention and Downed Suspects", "Police Department Rules"],
  ["Use of Force", "Police Department Rules"],
  ["Pursuits and PITs", "Police Department Rules"],
  ["Hostage and Robbery Scenes", "Police Department Rules"],
  ["Undercover Investigations", "Police Department Rules"],
  ["PD Documentation and Bodycam", "Police Department Rules"],
  ["EMS Scene Safety and Patient Care", "EMS Rules"],
  ["EMS Custody, Privacy, and Prohibited Assistance", "EMS Rules"]
]);
const emergencyGroupOrder = ["Department-Wide Rules", "Police Department Rules", "EMS Rules"];
const slug = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const app = document.createElement("div");
app.id = "rules-app";
document.body.replaceChildren(app);

function cleanLine(line) {
  let result = line.replace(/\\([\\`*_{}\[\]()#+\-.!>~])/g, "$1");
  result = result.replace(/^\*\*(#{1,3}\s.*)\*\*$/, "$1");
  result = result.replace(/\*{4}([^*]+)\*{4}/g, "**$1**");
  return result;
}

function parseRules(markdown) {
  const sections = [];
  let section = null;
  let subsection = null;
  let block = null;
  const flush = () => {
    if (!block) return;
    const owner = subsection || section;
    if (owner) owner.blocks.push(block);
    block = null;
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = cleanLine(raw).trim();
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2) {
      flush();
      section = { title: h2[1], blocks: [], subsections: [] };
      sections.push(section);
      subsection = null;
    } else if (h3 && section) {
      flush();
      subsection = { title: h3[1], blocks: [] };
      section.subsections.push(subsection);
    } else if (line) {
      if (!block) block = { type: "paragraph", lines: [] };
      const ordered = line.match(/^\d+\.\s+(.*)$/);
      const bullet = line.match(/^-\s+(.*)$/);
      const type = ordered ? "ol" : bullet ? "ul" : "paragraph";
      if (block.type !== type) { flush(); block = { type, lines: [] }; }
      block.lines.push(ordered ? ordered[1] : bullet ? bullet[1] : line);
    } else if (block && block.type === "paragraph") flush();
  }
  flush();
  return sections;
}

function appendInline(parent, text) {
  const chunks = text.split(/\*\*(.+?)\*\*/g);
  chunks.forEach((chunk, index) => {
    if (index % 2) { const strong = document.createElement("strong"); strong.textContent = chunk; parent.append(strong); }
    else parent.append(document.createTextNode(chunk));
  });
}

function appendBlocks(parent, blocks) {
  for (const block of blocks) {
    const element = document.createElement(block.type === "paragraph" ? "p" : block.type);
    for (const line of block.lines) {
      if (block.type === "paragraph") appendInline(element, line);
      else { const li = document.createElement("li"); appendInline(li, line); element.append(li); }
    }
    parent.append(element);
  }
}

function assignUnits(sections) {
  const units = { main: [], interaction: [], emergency: [] };
  for (const section of sections) {
    if (section.title === "Robbing / Scamming / Logging / Exploits" || section.title === "Government Job Rules") {
      for (const sub of section.subsections) {
        let set = section.title === "Government Job Rules" ? splitGov.get(sub.title) : splitCriminal.get(sub.title);
        if (!set) set = section.title === "Government Job Rules" ? "emergency" : "main";
        const category = set === "interaction" ? "Faction / Interaction Rules" : set === "main" ? "Main City Rules" : (emergencyGroups.get(sub.title) || "Department-Wide Rules");
        units[set].push({ title: sub.title, blocks: sub.blocks, category });
      }
      continue;
    }
    const set = Object.keys(SETS).find((key) => SETS[key].headings.includes(section.title)) || "main";
    units[set].push({ title: section.title, blocks: section.blocks, category: section.title, subsections: section.subsections });
  }
  return units;
}

function renderSite(units) {
  const path = location.pathname.replace(/\/+$/, "") || "/main";
  const routeKey = path === "/faction" ? "interaction" : path === "/emergency-services" ? "emergency" : "main";
  const config = SETS[routeKey];
  const assetPath = location.protocol === "file:" ? "assets" : "/assets";
  const shell = document.createElement("div");
  shell.className = "rules-shell";
  shell.innerHTML = `<header class="rules-topbar"><a class="site-mark" href="/main" aria-label="Main City Rules"><img src="${assetPath}/brick-city-rp-transparent.png" alt="Brick City RP"></a><label class="book-picker"><span>Rulebook</span><select aria-label="Choose a rulebook"><option value="/main">Main City Rules</option><option value="/faction">Faction / Interaction Rules</option><option value="/emergency-services">Emergency Services Rules</option></select></label><a class="discord-link" href="https://discord.gg/brickcityrp" target="_blank" rel="noreferrer">discord.gg/brickcityrp</a></header><main class="rules-content"><section class="rules-heading"><p class="rule-number"></p><h1></h1><p class="rules-intro"></p></section><div class="rules-sheet"></div></main>`;
  app.append(shell);
  const bookSelect = shell.querySelector(".book-picker select");
  bookSelect.value = routeKey === "interaction" ? "/faction" : routeKey === "emergency" ? "/emergency-services" : "/main";
  bookSelect.addEventListener("change", () => { window.location.href = bookSelect.value; });
  const content = shell.querySelector(".rules-sheet");
  shell.querySelector(".rules-heading .rule-number").textContent = config.eyebrow;
  shell.querySelector(".rules-heading h1").textContent = config.title;
  shell.querySelector(".rules-intro").textContent = config.intro;
  const renderUnits = routeKey === "emergency"
    ? [...units[routeKey]].sort((a, b) => emergencyGroupOrder.indexOf(a.category) - emergencyGroupOrder.indexOf(b.category))
    : units[routeKey];
  let lastEmergencyGroup = "";
  for (const unit of renderUnits) {
      if (routeKey === "emergency" && unit.category !== lastEmergencyGroup) {
        const group = document.createElement("h2");
        group.className = "rules-group-heading";
        group.textContent = unit.category;
        content.append(group);
        lastEmergencyGroup = unit.category;
      }
      const article = document.createElement("article"); article.className = "rule-card"; article.id = slug(unit.title);
      const heading = document.createElement("h2"); heading.textContent = unit.title; article.append(heading);
      appendBlocks(article, unit.blocks);
      for (const sub of unit.subsections || []) {
        if (sub.title === unit.title) { appendBlocks(article, sub.blocks); continue; }
        const h3 = document.createElement("h3"); h3.textContent = sub.title; article.append(h3); appendBlocks(article, sub.blocks);
      }
      content.append(article);
  }
}

const rulesSource = location.protocol === "file:" ? "RULES_BY_CATEGORY.md" : "/RULES_BY_CATEGORY.md";
fetch(rulesSource, { cache: "no-store" })
  .then((response) => { if (!response.ok) throw new Error("Could not load the rules source."); return response.text(); })
  .then(parseRules)
  .then(assignUnits)
  .then(renderSite)
  .catch(() => { app.innerHTML = '<main class="load-error"><h1>Rules temporarily unavailable</h1><p>Please refresh the page in a moment.</p></main>'; });
