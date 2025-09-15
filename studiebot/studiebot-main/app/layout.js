import './globals.css'

export const metadata = {
  title: 'Studiebot',
  description: 'Chatbot-geleide oefenapp voor middelbare scholieren',
}

// trigger: minor change to force rebuild
export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-600 text-white">
        {children}
      </body>
    </html>
  )
}