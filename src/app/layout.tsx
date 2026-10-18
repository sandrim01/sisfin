import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sisfin | Consultor Financeiro IA & Independência Financeira',
  description:
    'Assistente virtual de consultoria financeira que guia qualquer pessoa rumo à independência financeira com o salário que ganha hoje.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
