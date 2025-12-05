"use client"

import { Play, Star } from "lucide-react"
import { Card } from "@/components/ui/card"
import Image from "next/image"

const popularGames = [
  { id: 1, name: "Hash Dice", provider: "FairHash", rating: 4.8, plays: "2.4M", image: "dice" },
  { id: 2, name: "Crypto Crash", provider: "FairHash", rating: 4.9, plays: "3.1M", image: "crash" },
  { id: 3, name: "Plinko Extreme", provider: "SpribeGaming", rating: 4.7, plays: "1.8M", image: "plinko" },
  { id: 4, name: "Mega Roulette", provider: "Evolution", rating: 4.9, plays: "5.2M", image: "roulette" },
  { id: 5, name: "Sweet Bonanza", provider: "Pragmatic", rating: 4.8, plays: "4.7M", image: "slots" },
  { id: 6, name: "Aviator", provider: "Spribe", rating: 4.9, plays: "6.3M", image: "aviator" },
  { id: 7, name: "Mines", provider: "FairHash", rating: 4.6, plays: "1.5M", image: "mines" },
  { id: 8, name: "Blackjack VIP", provider: "Evolution", rating: 4.8, plays: "2.9M", image: "blackjack" },
  { id: 9, name: "Limbo", provider: "FairHash", rating: 4.7, plays: "1.2M", image: "limbo" },
  { id: 10, name: "Crazy Time", provider: "Evolution", rating: 4.9, plays: "7.1M", image: "crazytime" },
  { id: 11, name: "Wheel of Fortune", provider: "FairHash", rating: 4.5, plays: "980K", image: "wheel" },
  { id: 12, name: "Lightning Baccarat", provider: "Evolution", rating: 4.8, plays: "3.4M", image: "baccarat" },
]

export default function PopularGamesSection() {
  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-balance">Popular Games</h2>
          <p className="text-sm text-muted-foreground mt-1">Most played games this week</p>
        </div>
        <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">View All</button>
      </div>

      {/* Compact Grid - 6-12 items */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
        {popularGames.map((game) => (
          <Card
            key={game.id}
            className="group relative overflow-hidden cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300"
          >
            <div className="aspect-[3/4] relative">
              {/* Game Image */}
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-secondary/30">
                <Image
                  src={`/.jpg?height=300&width=225&query=${game.image}`}
                  alt={game.name}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/20 backdrop-blur-sm border border-primary flex items-center justify-center">
                    <Play className="h-6 w-6 text-primary fill-primary" />
                  </div>
                  <span className="text-xs font-medium text-primary">Play Now</span>
                </div>
              </div>

              {/* Rating Badge */}
              <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/70 backdrop-blur-sm flex items-center gap-1">
                <Star className="h-3 w-3 text-primary fill-primary" />
                <span className="text-xs font-bold text-foreground">{game.rating}</span>
              </div>
            </div>

            {/* Game Info */}
            <div className="p-2">
              <h3 className="font-semibold text-sm text-foreground truncate">{game.name}</h3>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground truncate">{game.provider}</span>
                <span className="text-xs text-accent-secondary font-medium">{game.plays}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
