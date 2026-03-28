import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{ title: 'SidClaw' }}
      links={[
        { text: 'Documentation', url: '/docs' },
        { text: 'Blog', url: '/blog' },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
