import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis · AoE1 Agent Lab',
  description:
    'Không gian chẩn đoán, nhật ký và nghiệm thu agent AoE1 v0.1 trong scenario có kiểm soát.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
