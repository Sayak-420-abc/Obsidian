import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
  title: "Obsidian - Agentic Text-to-SQL Console",
  description: "Explore, ingest, and query databases using natural language with the Obsidian Text-to-SQL agent.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0c0c] text-[#ededed] font-sans">
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#3ecf8e',
              colorBackground: '#171717',
              colorText: '#ededed',
              colorTextSecondary: '#737373',
              colorInputBackground: '#141414',
              colorInputBorder: '#2e2e2e',
              colorInputText: '#ededed',
              borderRadius: '6px'
            },
            elements: {
              card: "bg-[#171717] border border-[#2e2e2e] shadow-2xl rounded-md",
              headerTitle: "text-2xl font-bold tracking-tight text-white",
              headerSubtitle: "text-xs text-[#a3a3a3]",
              socialButtonsBlockButton: "bg-[#171717] hover:bg-[#222222] border border-[#2e2e2e] text-white hover:text-white transition-all font-semibold py-2.5 rounded-md",
              socialButtonsBlockButtonText: "text-white font-semibold",
              formButtonPrimary: "bg-[#24b47e] hover:bg-[#1f9b6c] text-white font-semibold py-2.5 rounded-md transition-colors border-none cursor-pointer",
              formFieldInput: "bg-[#141414] border border-[#2e2e2e] text-white rounded-md focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]",
              formFieldLabel: "text-[#ededed] font-medium text-xs mb-1.5",
              footerActionLink: "text-[#3ecf8e] hover:text-[#30b87c] hover:underline font-semibold",
              dividerLine: "bg-[#2e2e2e]",
              dividerText: "text-[#737373] text-xs uppercase font-mono",
              userButtonPopoverCard: "bg-[#171717] border border-[#2e2e2e] shadow-xl rounded-md overflow-hidden",
              userButtonPopoverActionButton: "hover:bg-[#242424] text-white transition-colors py-2 px-3",
              userButtonPopoverActionButtonIcon: "text-[#3ecf8e]",
              userButtonPopoverActionButtonText: "text-white font-medium text-xs",
              userButtonPopoverFooter: "bg-[#141414] border-t border-[#2e2e2e] py-1.5",
              userButtonPopoverFooterButton: "text-[#a3a3a3] hover:text-white transition-colors text-[10px]",
              userProfileModalCard: "bg-[#171717] border border-[#2e2e2e] shadow-2xl rounded-md overflow-hidden",
              userProfileModalSidebar: "bg-[#141414] border-r border-[#2e2e2e]",
              userProfileModalNavbar: "bg-[#141414]",
              userProfileModalHeaderTitle: "text-white font-bold",
              userProfileModalHeaderSubtitle: "text-[#a3a3a3]"
            }
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

