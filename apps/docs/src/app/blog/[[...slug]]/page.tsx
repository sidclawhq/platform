import { blogSource } from '@/lib/source';
import { DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import Link from 'next/link';
import type { Metadata } from 'next';

function BlogIndex() {
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

export default async function BlogPage(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;

  // No slug = blog index
  if (!params.slug || params.slug.length === 0) {
    return <BlogIndex />;
  }

  const page = blogSource.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <article className="max-w-3xl mx-auto py-12 px-6">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-3">{page.data.title}</h1>
        {page.data.description && (
          <p className="text-lg text-fd-muted-foreground">{page.data.description}</p>
        )}
      </header>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </article>
  );
}

export function generateStaticParams() {
  return blogSource.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;

  if (!params.slug || params.slug.length === 0) {
    return {
      title: 'Blog | SidClaw',
      description: 'Technical articles on AI agent governance, security, and compliance.',
    };
  }

  const page = blogSource.getPage(params.slug);
  if (!page) notFound();
  return {
    title: `${page.data.title} | SidClaw Blog`,
    description: page.data.description,
  };
}
