import { blogSource } from '@/lib/source';
import { DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';

export default async function BlogPage(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
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
  const page = blogSource.getPage(params.slug);
  if (!page) notFound();
  return {
    title: `${page.data.title} | SidClaw Blog`,
    description: page.data.description,
  };
}
