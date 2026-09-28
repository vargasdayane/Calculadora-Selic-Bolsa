import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SELIC vs Ações — Comparador de Investimentos",
  description:
    "Compare o rendimento da taxa SELIC com ações da B3. Simule investimentos e veja qual estratégia teria dado mais retorno no período selecionado.",
  keywords: "SELIC, ações, B3, investimentos, rendimento, comparador, bolsa de valores",
  openGraph: {
    title: "SELIC vs Ações — Comparador de Investimentos",
    description:
      "Compare o rendimento da taxa SELIC com ações da B3 em diferentes janelas de tempo.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
