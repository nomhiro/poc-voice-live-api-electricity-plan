export const metadata = {
  title: 'POC Voice Live API AI Agent'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial' }}>
        {children}
      </body>
    </html>
  )
}
