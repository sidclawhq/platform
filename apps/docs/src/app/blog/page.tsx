import { blogSource } from '@/lib/source';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | SidClaw',
  description: 'Technical articles on AI agent governance, security, and compliance.',
};

export default function BlogIndex() {
  const pages = blogSource.getPages();

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-bold tracking-tight mb-3">Blog</h1>
      <p className="text-lg text-fd-muted-foreground mb-10">
        Technical articles on AI agent governance, security, and compliance.
      </p>
      <div className="space-y-8">
        {pages.map((page) => (
          <article key={page.url} className="group">
            <Link href={page.url} className="block">
              <h2 className="text-xl font-semibold group-hover:text-fd-primary transition-colors">
                {page.data.title}
              </h2>
              {page.data.description && (
                <p className="text-fd-muted-foreground mt-1">{page.data.description}</p>
              )}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
