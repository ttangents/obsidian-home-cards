/**
 * Fill dek elements as their cards scroll into view.
 *
 * Observes against the viewport (`root: null`), which clips through any
 * scrolling ancestor. Observing against the container itself is wrong in
 * a Bases view: Bases owns the scrolling, the container is as tall as its
 * content, every card intersects it at once, and "lazy" reads all fire on
 * load.
 *
 * The caller owns the observer's lifetime: invoke the returned dispose
 * function from its unload path, or the observer keeps the subtree alive.
 */
export function observeDeks(
  root: HTMLElement,
  fill: (path: string, el: HTMLElement) => void
): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        const path = el.dataset.hcDekPath;
        if (path) fill(path, el);
      }
    },
    // Start one viewport early so the text is there on arrival.
    { root: null, rootMargin: "100% 0px" }
  );
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-hc-dek-path]"))) {
    observer.observe(el);
  }
  return () => observer.disconnect();
}
