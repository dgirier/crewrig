/// <reference lib="dom" />
// Tiny DOM helpers shared by the views.

export type Child = Node | string;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.append(...children);
  return el;
}

/** Text with `code` spans for backtick-delimited fragments. */
export function inline(text: string): Child[] {
  return text.split("`").map((part, i) => (i % 2 === 1 ? h("code", {}, [part]) : part));
}

/** Star rating: visible glyphs plus a text alternative. */
export function stars(count: number, label = ""): HTMLElement {
  const filled = "★".repeat(count);
  const empty = "☆".repeat(5 - count);
  const text = `${count} étoile${count > 1 ? "s" : ""} sur 5`;
  return h("span", { class: "stars" }, [
    h("span", { "aria-hidden": "true" }, [filled + empty]),
    h("span", { class: "visually-hidden" }, [label === "" ? text : `${label} : ${text}`]),
  ]);
}

/** Move keyboard focus to an element that is not normally focusable. */
export function focusHeading(el: HTMLElement): void {
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: false });
}

export function setTitle(title: string): void {
  document.title = title === "" ? "CrewRig Quest" : `${title} · CrewRig Quest`;
}
