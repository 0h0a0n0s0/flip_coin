"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Flame, Users, TrendingUp } from "lucide-react"
import Image from "next/image"

const trendingGames = [
  {
    id: 1,
    name: "Hash Dice 3D",
    thumbnail: "/futuristic-dice-game-neon.jpg",
    rtp: "99.5%",
    activeUsers: 8234,
    volume24h: "2.5M",
    hot: true,
  },
  {
    id: 2,
    name: "Crash Rocket",
    thumbnail: "/rocket-crash-game-cyberpunk.jpg",
    rtp: "99.0%",
    activeUsers: 12453,
    volume24h: "4.2M",
    hot: true,
  },
  {
    id: 3,
    name: "Limbo Extreme",
    thumbnail: "/limbo-gambling-game-dark.jpg",
    rtp: "99.2%",
    activeUsers: 5621,
    volume24h: "1.8M",
    hot: false,
  },
  {
    id: 4,
    name: "Plinko Paradise",
    thumbnail: "/plinko-game-neon-lights.jpg",
    rtp: "99.3%",
    activeUsers: 6892,
    volume24h: "2.1M",
    hot: false,
  },
]

export default function GameSectionTrending() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Trending Now</h2>
            <p className="text-sm text-muted-foreground">Sorted by 24h volume</p>
          </div>
        </div>
        <TrendingUp className="w-5 h-5 text-orange-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {trendingGames.map((game) => (
          <Card
            key={game.id}
            className="group overflow-hidden bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 transition-all duration-300 cursor-pointer hover:scale-105"
          >
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={game.thumbnail || "/placeholder.svg"}
                alt={game.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              {game.hot && (
                <Badge className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-red-500 border-0 text-white animate-pulse">
                  <Flame className="w-3 h-3 mr-1" />
                  HOT
                </Badge>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
            </div>

            <div className="p-4 space-y-3">
              <h3 className="font-bold text-lg">{game.name}</h3>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-accent" />
                  <span className="text-muted-foreground">{game.activeUsers.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-primary font-semibold">RTP {game.rtp}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground">24h Volume</div>
                <div className="text-lg font-bold text-primary">${game.volume24h}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
