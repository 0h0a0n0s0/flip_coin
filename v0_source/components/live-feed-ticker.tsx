"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"

interface WinEvent {
  id: string
  player: string
  game: string
  amount: number
  currency: string
  flag: string
  timestamp: Date
}

const mockWins: WinEvent[] = [
  {
    id: "1",
    player: "Player****8492",
    game: "Hash Dice",
    amount: 2450,
    currency: "USDT",
    flag: "🇺🇸",
    timestamp: new Date(),
  },
  {
    id: "2",
    player: "Crypto****2341",
    game: "Crash",
    amount: 8920,
    currency: "ETH",
    flag: "🇬🇧",
    timestamp: new Date(),
  },
  {
    id: "3",
    player: "Lucky****7756",
    game: "Roulette",
    amount: 15340,
    currency: "BTC",
    flag: "🇨🇦",
    timestamp: new Date(),
  },
  {
    id: "4",
    player: "Winner****9823",
    game: "Blackjack",
    amount: 4560,
    currency: "USDT",
    flag: "🇩🇪",
    timestamp: new Date(),
  },
  {
    id: "5",
    player: "Moon****1122",
    game: "Hash Dice",
    amount: 23100,
    currency: "ETH",
    flag: "🇯🇵",
    timestamp: new Date(),
  },
]

export default function LiveFeedTicker() {
  const [wins, setWins] = useState(mockWins)

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new win
      const newWin: WinEvent = {
        id: Date.now().toString(),
        player: `User****${Math.floor(Math.random() * 9000) + 1000}`,
        game: ["Hash Dice", "Crash", "Roulette", "Blackjack", "Slots"][Math.floor(Math.random() * 5)],
        amount: Math.floor(Math.random() * 20000) + 1000,
        currency: ["USDT", "ETH", "BTC"][Math.floor(Math.random() * 3)],
        flag: ["🇺🇸", "🇬🇧", "🇨🇦", "🇩🇪", "🇯🇵", "🇦🇺"][Math.floor(Math.random() * 6)],
        timestamp: new Date(),
      }
      setWins((prev) => [newWin, ...prev.slice(0, 4)])
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold">Live Wins</h2>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <Button variant="ghost" size="sm" className="text-accent hover:text-accent-foreground">
          View All
          <ExternalLink className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-3">
        {wins.map((win, index) => (
          <Card
            key={win.id}
            className={`
              p-4 bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 
              transition-all duration-300 cursor-pointer
              ${index === 0 ? "animate-in border-accent/50" : ""}
            `}
          >
            <div className="flex items-center gap-4">
              {/* Flag */}
              <div className="text-2xl opacity-50">{win.flag}</div>

              {/* Player & Game Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold truncate">{win.player}</span>
                  <span className="text-xs text-muted-foreground">won</span>
                </div>
                <div className="text-sm text-muted-foreground">{win.game}</div>
              </div>

              {/* Amount */}
              <div className="text-right">
                <div className="text-xl md:text-2xl font-bold text-primary">+{win.amount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{win.currency}</div>
              </div>

              {/* Play Now CTA */}
              <Button
                size="sm"
                variant="outline"
                className="hidden md:flex border-accent/50 hover:bg-accent/10 bg-transparent"
              >
                Play Now
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
