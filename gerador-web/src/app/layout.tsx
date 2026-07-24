import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { getThemeConfig } from "@/actions/theme-config";
import { ThemeWatcher } from "@/components/theme-watcher";

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getThemeConfig();
  const projectName = theme?.projectName || "AuthForge";
  
  return {
    title: `${projectName} — Painel Administrativo`,
    description: "Sistema de autenticação completo e seguro para suas aplicações",
    icons: theme?.faviconUrl ? [{ url: theme.faviconUrl }] : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeConfig();

  const dynamicStyles = theme ? `
    :root {
      --primary: ${theme.primaryColor};
      --secondary: ${theme.secondaryColor};
      --tertiary: ${theme.accentColor}; /* Accent = Tertiary no nosso CSS */
    }
    .dark {
      --primary: ${theme.primaryColor};
      --secondary: ${theme.secondaryColor};
      --tertiary: ${theme.accentColor};
    }
  ` : '';

  // Tema padrão definido no servidor para evitar flash
  const isDark = theme?.defaultTheme === 'dark' || !theme;

  return (
    <html lang="pt-BR" className={isDark ? 'dark' : ''} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {dynamicStyles && <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />}
      </head>
      <body className="antialiased">
        <ThemeWatcher defaultTheme={theme?.defaultTheme || 'dark'} />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
