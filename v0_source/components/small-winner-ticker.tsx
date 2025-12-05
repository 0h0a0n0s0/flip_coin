"use client"

import { Trophy, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const mockWins = [
  { user: "Player***89", game: "Hash Dice", amount: "0.45 BTC", multiplier: "12.5x", time: "Just now" },
  { user: "Crypto***23", game: "Mega Roulette", amount: "1.2 ETH", multiplier: "35x", time: "1m ago" },
  { user: "Whale***56", game: "Aviator", amount: "2.8 BTC", multiplier: "48.3x", time: "2m ago" },
  { user: "Lucky***91", game: "Plinko", amount: "0.87 BTC", multiplier: "21x", time: "3m ago" },
  { user: "High***42", game: "Crash", amount: "1.5 BTC", multiplier: "28.7x", time: "4m ago" },
  { user: "Pro***12", game: "Sweet Bonanza", amount: "0.95 ETH", multiplier: "15.2x", time: "5m ago" },
  { user: "Win***77", game: "Limbo", amount: "0.63 BTC", multiplier: "18.9x", time: "6m ago" },
  { user: "Bet***34", game: "Mines", amount: "1.1 BTC", multiplier: "24.6x", time: "7m ago" },
  { user: "King***99", game: "Blackjack", amount: "0.78 ETH", multiplier: "2x", time: "8m ago" },
  { user: "Fast***45", game: "Crazy Time", amount: "3.2 BTC", multiplier: "52.1x", time: "9m ago" },
  { user: "Luck***88", game: "Wheel", amount: "0.54 BTC", multiplier: "11.3x", time: "10m ago" },
  { user: "Ace***67", game: "Dice", amount: "1.8 ETH", multiplier: "32.5x", time: "11m ago" },
  { user: "Boss***21", game: "Plinko", amount: "0.92 BTC", multiplier: "19.7x", time: "12m ago" },
  { user: "Max***53", game: "Slots", amount: "1.4 BTC", multiplier: "25.8x", time: "13m ago" },
  { user: "Top***76", game: "Baccarat", amount: "0.68 ETH", multiplier: "1.95x", time: "14m ago" },
]

export default function SmallWinnerTicker() {
  const [wins, setWins] = useState(mockWins)
  const [newWinId, setNewWinId] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new win
      const newWin = {
        user: `User***${Math.floor(Math.random() * 100)}`,
        game: ["Hash Dice", "Aviator", "Plinko", "Crash", "Roulette"][Math.floor(Math.random() * 5)],
        amount: `${(Math.random() * 3).toFixed(2)} ${Math.random() > 0.5 ? "BTC" : "ETH"}`,
        multiplier: `${(Math.random() * 50 + 1).toFixed(1)}x`,
        time: "Just now",
      }
      setWins((prev) => [newWin, ...prev.slice(0, 14)])
      setNewWinId(Date.now())
      setTimeout(() => setNewWinId(null), 1000)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-md p-2 md:p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/50">
          <Trophy className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-foreground">Latest Wins</h3>
          <p className="text-[10px] text-muted-foreground">Live results from players</p>
        </div>
      </div>

      {/* Vertical scrollable list - shows 5-6 at a time */}
      <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1">
        {wins.map((win, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-between gap-2 p-1.5 rounded-md bg-secondary/30 border border-transparent transition-all duration-300",
              index === 0 && newWinId && "border-primary/50 bg-primary/10",
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-accent/20 to-accent-secondary/20">
                <Zap className="h-2.5 w-2.5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground truncate">{win.user}</span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">won</span>
                </div>
                <span className="text-[10px] text-muted-foreground truncate block">{win.game}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="text-[11px] font-bold text-primary">{win.amount}</div>
                <div className="text-[9px] text-muted-foreground">{win.time}</div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-accent/20 to-accent-secondary/20 border border-accent/50 text-accent">
                {win.multiplier}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
