const links = [...document.querySelectorAll(".outline-nav a")];
const sections = [...document.querySelectorAll(".rule-card, .rule-card h2[id]")];

function scrollToRule(id) {
  const section = document.getElementById(id);
  if (!section) return false;
  window.scrollTo({
    top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - 14),
    behavior: "smooth"
  });
  return true;
}

function updateActiveLink() {
  const active = [...sections].reverse().find((section) => section.getBoundingClientRect().top <= 120) || sections[0];
  links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${active.id}`));
}

links.forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href").slice(1);
    if (!scrollToRule(id)) return;
    event.preventDefault();
    history.pushState(null, "", `#${id}`);
    updateActiveLink();
  });
});

window.addEventListener("scroll", updateActiveLink, { passive: true });
window.addEventListener("resize", updateActiveLink);
window.addEventListener("load", () => {
  const id = location.hash.slice(1);
  if (id) requestAnimationFrame(() => scrollToRule(id));
  updateActiveLink();
});
