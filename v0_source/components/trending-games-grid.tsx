"use client"

import { Play, Star, Heart, Zap, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState } from "react"

const games = [
  { id: 1, name: "Hash Dice", provider: "FairHash", rating: 4.8, volume: "$124K", hot: true, new: false },
  { id: 2, name: "Crypto Crash", provider: "FairHash", rating: 4.9, volume: "$231K", hot: true, new: false },
  { id: 3, name: "Plinko Extreme", provider: "Spribe", rating: 4.7, volume: "$89K", hot: false, new: true },
  { id: 4, name: "Mega Roulette", provider: "Evolution", rating: 4.9, volume: "$456K", hot: true, new: false },
  { id: 5, name: "Sweet Bonanza", provider: "Pragmatic Play", rating: 4.8, volume: "$387K", hot: false, new: false },
  { id: 6, name: "Aviator", provider: "Spribe", rating: 4.9, volume: "$612K", hot: true, new: false },
  { id: 7, name: "Mines", provider: "FairHash", rating: 4.6, volume: "$73K", hot: false, new: true },
  { id: 8, name: "Blackjack VIP", provider: "Evolution", rating: 4.8, volume: "$298K", hot: false, new: false },
  { id: 9, name: "Limbo", provider: "FairHash", rating: 4.7, volume: "$156K", hot: false, new: false },
  { id: 10, name: "Crazy Time", provider: "Evolution", rating: 4.9, volume: "$723K", hot: true, new: false },
  { id: 11, name: "Wheel Fortune", provider: "FairHash", rating: 4.5, volume: "$94K", hot: false, new: true },
  { id: 12, name: "Lightning Baccarat", provider: "Evolution", rating: 4.8, volume: "$341K", hot: false, new: false },
]

const filters = ["Recommended", "Recently Played", "Hot", "New", "Providers"]

export default function TrendingGamesGrid() {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState("Recommended")
  const [isLoading, setIsLoading] = useState(false)

  return (
    <section className="py-2">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <h2 className="text-base md:text-lg font-bold text-foreground">Trending Now</h2>
          <p className="text-[10px] md:text-[11px] text-muted-foreground mt-0.5">24h Volume Leaders</p>
        </div>
        <button className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
          View All →
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto scrollbar-none pb-1">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
              activeFilter === filter
                ? "bg-primary/20 text-primary border border-primary/50"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 md:gap-2">
        {isLoading
          ? // Loading Skeletons
            Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm rounded-md">
                <div className="relative h-[105px] md:h-[115px] p-1.5 animate-pulse">
                  <div className="h-[70px] md:h-[75px] bg-secondary/50 rounded-md mb-1.5" />
                  <div className="space-y-1">
                    <div className="h-3 bg-secondary/50 rounded w-3/4" />
                    <div className="h-2 bg-secondary/50 rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))
          : games.map((game) => {
              const isHovered = hoveredId === game.id

              return (
                <Card
                  key={game.id}
                  onMouseEnter={() => setHoveredId(game.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group relative overflow-hidden cursor-pointer border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 rounded-md"
                >
                  <div className="relative h-[105px] md:h-[115px] p-1.5 flex flex-col">
                    {/* Badges */}
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5 z-10">
                      {game.hot && (
                        <Badge className="h-4 px-1 text-[9px] bg-red-500/90 text-white border-0">
                          <Zap className="w-2 h-2 mr-0.5 fill-current" />
                          HOT
                        </Badge>
                      )}
                      {game.new && (
                        <Badge className="h-4 px-1 text-[9px] bg-green-500/90 text-white border-0">NEW</Badge>
                      )}
                    </div>

                    {/* Game Cover Thumbnail - 4:3 ratio */}
                    <div className="flex-1 relative rounded-md overflow-hidden bg-gradient-to-br from-secondary/50 to-secondary/30 mb-1.5 group-hover:shadow-md transition-shadow">
                      <Image
                        src={`/.jpg?height=90&width=200&query=${game.name} casino game`}
                        alt={game.name}
                        fill
                        className="object-cover"
                      />

                      {/* Hover Overlay with Play/Demo buttons */}
                      <div
                        className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200 flex flex-col items-center justify-center gap-1 ${
                          isHovered ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <Button className="h-7 px-3 text-[11px] bg-primary hover:bg-primary/90 rounded-md shadow-lg">
                          <Play className="w-2.5 h-2.5 mr-1 fill-current" />
                          Play
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-[10px] bg-background/20 border-border/50 rounded-md"
                          >
                            Demo
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-background/20 rounded-md">
                            <Heart className="w-2.5 h-2.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-background/20 rounded-md">
                            <Info className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Game Info */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[12px] leading-tight truncate">{game.name}</h3>
                        <p className="text-[10px] text-muted-foreground truncate">{game.provider}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-primary fill-primary" />
                          <span className="text-[10px] font-semibold">{game.rating}</span>
                        </div>
                        <span className="text-[9px] text-accent-secondary font-medium">{game.volume}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
      </div>
    </section>
  )
}
