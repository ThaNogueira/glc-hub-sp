import { marked } from "marked";

/**
 * Markdown do guia de deck → HTML seguro: o texto é escapado antes do parse,
 * então só as construções do próprio markdown viram HTML.
 */
export function renderMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return marked.parse(escaped, { async: false, breaks: true }) as string;
}
