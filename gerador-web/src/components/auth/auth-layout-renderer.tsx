'use client';

import { ReactNode } from 'react';
import type { ThemeConfig } from '@prisma/client';
import { CenteredLayout } from './layouts/centered-layout';
import { SplitLayout } from './layouts/split-layout';
import { MinimalLayout } from './layouts/minimal-layout';

interface AuthLayoutRendererProps {
  theme: ThemeConfig;
  children: ReactNode;
}

export function AuthLayoutRenderer({ theme, children }: AuthLayoutRendererProps) {
  switch (theme.loginLayout) {
    case 'split':
      return <SplitLayout theme={theme}>{children}</SplitLayout>;
    case 'minimal':
      return <MinimalLayout theme={theme}>{children}</MinimalLayout>;
    case 'centered':
    default:
      return <CenteredLayout theme={theme}>{children}</CenteredLayout>;
  }
}
