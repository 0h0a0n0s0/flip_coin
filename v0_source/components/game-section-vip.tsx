"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, Lock } from "lucide-react"
import Image from "next/image"

const vipGames = [
  {
    id: 1,
    name: "Diamond Roulette VIP",
    thumbnail: "/luxury-roulette-gold-diamond.jpg",
    minVipLevel: 3,
    maxBet: "50,000 USDT",
  },
  {
    id: 2,
    name: "Platinum Blackjack",
    thumbnail: "/platinum-blackjack-luxury-casino.jpg",
    minVipLevel: 4,
    maxBet: "100,000 USDT",
  },
  {
    id: 3,
    name: "Exclusive Crash VIP",
    thumbnail: "/exclusive-crash-game-gold.jpg",
    minVipLevel: 5,
    maxBet: "200,000 USDT",
  },
]

export default function GameSectionVIP() {
  // Simulate user VIP level (would come from auth context)
  const userVipLevel = 0 // 0 means not logged in or no VIP status

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/50">
          <Crown className="w-6 h-6 text-yellow-900" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">
              VIP Exclusive
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">Premium games for high rollers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {vipGames.map((game) => {
          const isLocked = userVipLevel < game.minVipLevel

          return (
            <Card
              key={game.id}
              className={`
                group relative overflow-hidden backdrop-blur-sm transition-all duration-300
                ${
                  isLocked
                    ? "bg-card/30 border-yellow-500/20 cursor-not-allowed"
                    : "bg-card/50 border-yellow-500/50 cursor-pointer hover:scale-105 hover:border-yellow-500"
                }
              `}
            >
              {/* Golden Frame Effect */}
              <div className="absolute inset-0 border-2 border-yellow-500/20 rounded-lg pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />

              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={game.thumbnail || "/placeholder.svg"}
                  alt={game.name}
                  fill
                  className={`object-cover transition-transform duration-500 ${
                    isLocked ? "blur-sm grayscale" : "group-hover:scale-110"
                  }`}
                />

                {/* Lock Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Lock className="w-12 h-12 text-yellow-500 mx-auto" />
                      <div className="text-sm font-semibold">VIP Level {game.minVipLevel} Required</div>
                    </div>
                  </div>
                )}

                <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-yellow-600 border-0 text-yellow-900 font-bold">
                  <Crown className="w-3 h-3 mr-1" />
                  VIP {game.minVipLevel}+
                </Badge>

                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
              </div>

              <div className="p-4 space-y-3">
                <h3 className="font-bold text-lg">{game.name}</h3>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Max Bet</div>
                  <div className="text-lg font-bold text-yellow-500">{game.maxBet}</div>
                </div>

                {isLocked && (
                  <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                    Upgrade to VIP {game.minVipLevel} to unlock
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
