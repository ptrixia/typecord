export type LocalMessageSearchRecord = {
  id: string;
  content: string;
  author: string;
  scopeId: string;
  scopeLabel: string;
  href: string;
  createdAt: number;
};

const records = new Map<string, LocalMessageSearchRecord>();
const MAX_RECORDS = 10_000;

export function indexLocalMessages(items: LocalMessageSearchRecord[]) {
  for (const item of items) {
    const content = item.content.trim();
    if (!content) continue;
    records.set(item.id, { ...item, content });
  }

  if (records.size <= MAX_RECORDS) return;
  const oldest = [...records.values()]
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(0, records.size - MAX_RECORDS);
  for (const item of oldest) records.delete(item.id);
}

export function searchLocalMessages(query: string, limit = 8) {
  const terms = query
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) return [];

  return [...records.values()]
    .filter((item) => {
      const haystack = `${item.content} ${item.author} ${item.scopeLabel}`.toLocaleLowerCase("pt-BR");
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

export function clearLocalMessageIndex() {
  records.clear();
}
