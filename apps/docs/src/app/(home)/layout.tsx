import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{ title: 'SidClaw' }}
      links={[
        { text: 'Documentation', url: '/docs' },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
