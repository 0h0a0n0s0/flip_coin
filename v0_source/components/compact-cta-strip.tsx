"use client"

import { Gift, LogIn, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import WalletModal from "./wallet-modal"

export default function CompactCTAStrip() {
  const [walletOpen, setWalletOpen] = useState(false)

  return (
    <>
      <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 border-b border-border/50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Welcome Bonus Text */}
            <div className="flex items-center gap-2 text-sm md:text-base">
              <Gift className="h-5 w-5 text-primary" />
              <span className="text-foreground font-medium">
                <span className="font-bold text-primary">200% Welcome Bonus</span> up to 5 BTC + 100 Free Spins
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="outline" size="sm" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                <LogIn className="h-4 w-4 mr-2" />
                Sign Up
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                onClick={() => setWalletOpen(true)}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Quick Deposit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <WalletModal open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  )
}
