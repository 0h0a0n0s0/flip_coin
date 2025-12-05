"use client"

import { Home, Menu, MessageCircle, User, Wallet } from "lucide-react"
import { useState } from "react"
import SidebarDrawer from "./sidebar-drawer"
import WalletModal from "./wallet-modal"

const navItems = [
  { icon: Menu, label: "Menu", id: "menu" },
  { icon: Home, label: "Home", id: "home" },
  { icon: Wallet, label: "Deposit", id: "deposit", highlight: true },
  { icon: MessageCircle, label: "Chat", id: "chat" },
  { icon: User, label: "Me", id: "me" },
]

export default function MobileBottomNav() {
  const [activeTab, setActiveTab] = useState("home")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  const handleNavClick = (id: string) => {
    setActiveTab(id)
    if (id === "menu") {
      setSidebarOpen(true)
    } else if (id === "deposit") {
      setWalletOpen(true)
    }
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid grid-cols-5 h-12">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  item.highlight
                    ? "relative"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.highlight ? (
                  <div className="absolute -top-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/50">
                    <Icon className="h-[18px] w-[18px] text-primary-foreground" />
                  </div>
                ) : (
                  <>
                    <Icon className="h-[18px] w-[18px]" />
                    <span className="text-[9px] font-medium">{item.label}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <SidebarDrawer open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <WalletModal open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  )
}
