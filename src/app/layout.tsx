import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NDR Levels — /ES Futures',
  description: 'New Day Range level calculator with 10-year historical backtest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="bg-[#0d1117] text-[#e6edf3] antialiased h-full">{children}</body>
    </html>
  )
}
