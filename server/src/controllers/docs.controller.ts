import type { RequestHandler } from 'express';
import { openApiDocument } from '../openapi/document';

interface Operation {
  tags?: readonly string[];
  summary?: string;
  security?: readonly unknown[];
}

interface DocumentShape {
  info: { title: string; version: string; description?: string };
  tags: readonly { name: string; description?: string }[];
  paths: Record<string, Record<string, unknown>>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPage(): string {
  const doc = openApiDocument as unknown as DocumentShape;
  const grouped = new Map<string, { method: string; path: string; summary: string; secured: boolean }[]>();

  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const operation = item[method] as Operation | undefined;
      if (!operation) continue;
      const tag = operation.tags?.[0] ?? 'Other';
      if (!grouped.has(tag)) grouped.set(tag, []);
      grouped.get(tag)!.push({
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? '',
        secured: Array.isArray(operation.security) && operation.security.length > 0,
      });
    }
  }

  const sections = doc.tags
    .filter((tag) => grouped.has(tag.name))
    .map((tag) => {
      const rows = grouped
        .get(tag.name)!
        .map(
          (entry) => `<li>
        <span class="method ${entry.method.toLowerCase()}">${entry.method}</span>
        <code>${escapeHtml(entry.path)}</code>
        ${entry.secured ? '<span class="lock" title="Requires a bearer token">auth</span>' : ''}
        <span class="summary">${escapeHtml(entry.summary)}</span>
      </li>`,
        )
        .join('\n');
      return `<section>
      <h2>${escapeHtml(tag.name)}</h2>
      ${tag.description ? `<p class="muted">${escapeHtml(tag.description)}</p>` : ''}
      <ul>${rows}</ul>
    </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.info.title)}</title>
<link rel="alternate" type="application/json" href="/api/openapi.json">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8fafc; color: #0f172a; font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 40px 20px 64px; }
  header { border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 8px; }
  h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.02em; }
  h2 { font-size: 17px; margin: 32px 0 4px; }
  p { margin: 0 0 10px; }
  .muted { color: #475569; }
  a { color: #0b6b3a; }
  ul { list-style: none; margin: 8px 0 0; padding: 0; border-top: 1px solid #e2e8f0; }
  li { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; padding: 10px 2px; border-bottom: 1px solid #e2e8f0; }
  code { font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; color: #0f172a; }
  .method { font: 700 11px/1 ui-monospace, monospace; letter-spacing: 0.04em; padding: 4px 6px; border-radius: 4px; color: #fff; background: #475569; min-width: 54px; text-align: center; }
  .method.get { background: #0b6b3a; }
  .method.post { background: #1d4ed8; }
  .method.patch { background: #a16207; }
  .method.put { background: #7c3aed; }
  .method.delete { background: #b91c1c; }
  .lock { font: 600 10px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border: 1px solid #cbd5e1; border-radius: 999px; padding: 3px 7px; }
  .summary { flex: 1 1 240px; color: #334155; }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escapeHtml(doc.info.title)} <span class="muted">v${escapeHtml(doc.info.version)}</span></h1>
    <p class="muted">${escapeHtml(doc.info.description ?? '')}</p>
    <p><a href="/api/openapi.json">OpenAPI JSON</a></p>
  </header>
  ${sections}
</main>
</body>
</html>`;
}

export const openapiJson: RequestHandler = (_req, res) => {
  res.status(200).json(openApiDocument);
};

export const docsPage: RequestHandler = (_req, res) => {
  res.type('html').send(renderPage());
};
