import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'HIDEYOU PRO',
  description: 'VPN Management + Accounting Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#2C2C2A',
              border: '0.5px solid #D3D1C7',
              borderRadius: '10px',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            },
            success: { iconTheme: { primary: '#1D9E75', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#E24B4A', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
