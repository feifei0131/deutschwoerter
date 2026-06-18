import './globals.css'

export const metadata = {
  title: 'Deutsch Wörter - 德语单词学习',
  description: '用联想和趣味素材记德语单词',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}