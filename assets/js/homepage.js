import { loadCatalog, visibleCatalogItems } from "./catalog.js?v=10";
import { formatCount } from "./utils.js?v=10";
import { initAccountLinks } from "./account-widget.js?v=10";

const navigation = document.querySelector("#categoryNavigation");
const catalogRoot = document.querySelector("#toolCatalog");
const status = document.querySelector("#catalogStatus");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sortedByOrder(items) {
  return [...items].sort((left, right) =>
    left.order - right.order || left.title.localeCompare(right.title, "ru")
  );
}

function buildNavigation(section, itemCount) {
  const link = element("a", "tool-category-link");
  link.href = `#${section.id}`;
  link.style.setProperty("--category-accent", section.color);

  link.append(element("span", "tool-category-dot"));
  link.firstElementChild.setAttribute("aria-hidden", "true");

  const copy = element("span");
  copy.append(element("strong", "", section.title));
  copy.append(element(
    "small",
    "",
    formatCount(itemCount, section.countWords.one, section.countWords.few, section.countWords.many)
  ));
  link.append(copy);
  return link;
}

function buildCard(item) {
  const card = element("article", `tool-card${item.wide ? " tool-card-wide" : ""}`);
  card.style.setProperty("--tool-accent", item.color);
  card.style.setProperty("--tool-soft", item.softColor);

  const top = element("div", "tool-card-top");
  const headingGroup = element("div");
  const kickerRow = element("div", "tool-kicker-row");
  kickerRow.append(element("span", "tool-kicker", item.kicker));

  const badgeText = item.status === "beta" ? "beta" : item.badge;
  if (badgeText) {
    const badge = element("span", `tool-badge${item.status === "beta" ? " tool-badge-beta" : ""}`, badgeText);
    kickerRow.append(badge);
  }
  headingGroup.append(kickerRow);
  headingGroup.append(element("h3", "", item.title));

  const symbol = element("div", "tool-symbol", item.symbol);
  symbol.setAttribute("aria-hidden", "true");
  top.append(headingGroup, symbol);

  const bottom = element("div", "tool-card-bottom");
  bottom.append(element("span", "tool-meta", item.meta));
  const link = element("a", "tool-link", item.linkLabel);
  link.href = item.url;
  bottom.append(link);

  card.append(top, element("p", "", item.description), bottom);
  return card;
}

function buildSection(section, items) {
  const group = element("section", "tool-group");
  group.id = section.id;
  const headingId = `catalog-section-${section.id}-title`;
  group.setAttribute("aria-labelledby", headingId);

  const head = element("div", "tool-group-head");
  const titleGroup = element("div");
  const kicker = element("div", "tool-group-kicker", section.kicker);
  kicker.style.color = section.color;
  const title = element("h2", "", section.title);
  title.id = headingId;
  titleGroup.append(kicker, title);
  head.append(titleGroup, element("p", "", section.description));

  const grid = element("div", "tool-grid");
  sortedByOrder(items).forEach((item) => grid.append(buildCard(item)));
  group.append(head, grid);
  return group;
}

function buildHomepage(catalog) {
  const visibleItems = visibleCatalogItems(catalog);
  const sections = sortedByOrder(catalog.sections)
    .map((section) => ({
      section,
      items: visibleItems.filter((item) => item.section === section.id)
    }))
    .filter(({ items }) => items.length > 0);

  const navigationFragment = document.createDocumentFragment();
  const catalogFragment = document.createDocumentFragment();
  sections.forEach(({ section, items }) => {
    navigationFragment.append(buildNavigation(section, items.length));
    catalogFragment.append(buildSection(section, items));
  });

  return { navigationFragment, catalogFragment };
}

async function initHomepage() {
  void initAccountLinks();
  if (!navigation || !catalogRoot || !status) return;

  try {
    const catalog = await loadCatalog();
    const built = buildHomepage(catalog);

    navigation.replaceChildren(built.navigationFragment);
    catalogRoot.replaceChildren(built.catalogFragment);
    status.textContent = "Каталог обновлён.";
    status.classList.add("catalog-status-success");
  } catch (error) {
    console.error("Не удалось построить каталог:", error);
    status.textContent = "Не удалось обновить каталог автоматически. Показана резервная версия.";
    status.classList.add("catalog-status-error");
  }
}

initHomepage();
