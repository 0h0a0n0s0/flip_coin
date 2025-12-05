"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Calendar } from "lucide-react"
import Image from "next/image"

const newGames = [
  {
    id: 1,
    name: "Quantum Mines",
    thumbnail: "/mines-game-quantum-theme.jpg",
    releaseDate: "2024-12-01",
    category: "Hash Game",
  },
  {
    id: 2,
    name: "Neon Wheel",
    thumbnail: "/wheel-fortune-neon-cyberpunk.jpg",
    releaseDate: "2024-11-28",
    category: "Live Game",
  },
  {
    id: 3,
    name: "Crypto Keno",
    thumbnail: "/keno-cryptocurrency-dark.jpg",
    releaseDate: "2024-11-25",
    category: "Classic",
  },
  {
    id: 4,
    name: "Hash Tower",
    thumbnail: "/tower-climbing-game-futuristic.jpg",
    releaseDate: "2024-11-22",
    category: "Hash Game",
  },
  {
    id: 5,
    name: "Space Slots",
    thumbnail: "/space-slot-machine-stars.jpg",
    releaseDate: "2024-11-20",
    category: "Slots",
  },
  {
    id: 6,
    name: "Lightning Baccarat",
    thumbnail: "/baccarat-lightning-casino.jpg",
    releaseDate: "2024-11-18",
    category: "Live Casino",
  },
]

export default function GameSectionNew() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">New Releases</h2>
          <p className="text-sm text-muted-foreground">Just launched this month</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {newGames.map((game) => (
          <Card
            key={game.id}
            className="group overflow-hidden bg-card/50 backdrop-blur-sm border-accent/20 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer hover:scale-105"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={game.thumbnail || "/placeholder.svg"}
                alt={game.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <Badge className="absolute top-2 left-2 bg-gradient-to-r from-cyan-500 to-blue-500 border-0 text-white">
                NEW
              </Badge>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
            </div>

            <div className="p-3 space-y-2">
              <h3 className="font-semibold text-sm truncate">{game.name}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {new Date(game.releaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <Badge variant="outline" className="text-xs border-accent/30">
                {game.category}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
