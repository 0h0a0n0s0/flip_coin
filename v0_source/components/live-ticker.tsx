"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"

const winMessages = [
  { user: "User***888", game: "Hash Dice", amount: "5,000 USDT" },
  { user: "Player***123", game: "Hash Baccarat", amount: "12,500 USDT" },
  { user: "Lucky***456", game: "Block Roulette", amount: "8,200 USDT" },
  { user: "Winner***789", game: "Hash Bulls", amount: "3,750 USDT" },
  { user: "King***999", game: "Hash Dice", amount: "15,000 USDT" },
]

export default function LiveTicker() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % winMessages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const current = winMessages[currentIndex]

  return (
    <div className="border-b border-border/40 bg-secondary/30 overflow-hidden">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
          <div
            className="flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500"
            key={currentIndex}
          >
            <span className="text-muted-foreground">🎉</span>
            <span className="font-semibold text-foreground">{current.user}</span>
            <span className="text-muted-foreground">won</span>
            <span className="font-bold text-primary">{current.amount}</span>
            <span className="text-muted-foreground">in</span>
            <span className="font-semibold text-accent">{current.game}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
