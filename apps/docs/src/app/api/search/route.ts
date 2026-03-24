import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import type { InferPageType } from 'fumadocs-core/source';

export const { GET } = createFromSource(source, {
  buildIndex: async (page: InferPageType<typeof source>) => {
    // Extract structured data — available directly or via lazy load
    let structuredData: StructuredData | undefined;

    const data: unknown = page.data;
    const record = data as Record<string, unknown>;
    if (record && typeof record === 'object' && 'structuredData' in record) {
      structuredData = record.structuredData as StructuredData;
    } else if (record && typeof record === 'object' && 'load' in record && typeof record.load === 'function') {
      const loaded = await (record.load as () => Promise<{ structuredData?: StructuredData }>)();
      structuredData = loaded.structuredData;
    }

    return {
      id: page.url,
      title: page.data.title ?? '',
      url: page.url,
      description: page.data.description,
      structuredData: structuredData ?? { headings: [], contents: [] },
    };
  },
});
