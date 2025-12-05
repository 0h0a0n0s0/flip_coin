"use client"

import { Search, User, Wallet, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import WalletModal from "./wallet-modal"

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [walletOpen, setWalletOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-[1400px] px-3 md:px-4 py-1.5 md:py-1.5">
          <div className="flex items-center justify-between gap-3 md:gap-4">
            {/* Logo */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex h-7 w-7 md:h-7 md:w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-secondary">
                <div className="text-[13px] font-bold text-foreground">#</div>
              </div>
              <span className="text-sm md:text-base font-bold tracking-tight text-foreground">FairHash</span>
            </div>

            {/* Search Bar - 32-40% width on desktop */}
            <div className="hidden md:flex flex-1 max-w-[35%]">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search games..."
                  className="h-8 pl-9 bg-secondary/50 border-border/50 text-[13px] rounded-lg focus-visible:ring-primary/50"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {isLoggedIn ? (
                <>
                  <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2.5 py-1 border border-border/50">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[13px] font-semibold text-foreground">$1,250.00</span>
                  </div>
                  <Button
                    onClick={() => setWalletOpen(true)}
                    className="h-8 md:h-8 px-3 md:px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[12px] md:text-[13px] rounded-lg shadow-sm"
                  >
                    Deposit
                  </Button>
                  <Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8">
                    <User className="h-[18px] w-[18px]" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" className="hidden md:flex h-8 px-3 text-[13px] gap-1.5">
                    <LogIn className="h-3.5 w-3.5" />
                    Login
                  </Button>
                  <Button className="h-8 px-3 md:px-4 bg-gradient-to-r from-accent to-accent-secondary hover:opacity-90 text-foreground font-semibold text-[12px] md:text-[13px] rounded-lg shadow-sm">
                    Sign Up
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden md:flex h-8 px-3 text-[13px] border-primary/50 text-primary hover:bg-primary/10 bg-transparent"
                  >
                    Quick Demo
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <WalletModal open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  )
}
