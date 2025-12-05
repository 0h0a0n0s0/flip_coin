"use client"

import { Card } from "@/components/ui/card"
import { Hash, Sparkles, Trophy, Video, Gamepad2, Dice5 } from "lucide-react"
import { useState } from "react"

const tiles = [
  {
    id: "hash",
    title: "Hash Games",
    icon: Hash,
    gradient: "from-accent via-accent-secondary to-accent",
    count: "12 Games",
  },
  {
    id: "slots",
    title: "Slots",
    icon: Sparkles,
    gradient: "from-primary via-yellow-500 to-primary",
    count: "5000+ Games",
  },
  {
    id: "sports",
    title: "Sports",
    icon: Trophy,
    gradient: "from-green-500 via-emerald-400 to-green-500",
    count: "Live Odds",
  },
  {
    id: "live",
    title: "Live Casino",
    icon: Video,
    gradient: "from-red-500 via-pink-500 to-red-500",
    count: "Real Dealers",
  },
  {
    id: "originals",
    title: "Originals",
    icon: Gamepad2,
    gradient: "from-blue-500 via-cyan-400 to-blue-500",
    count: "Exclusive",
  },
  {
    id: "table",
    title: "Table Games",
    icon: Dice5,
    gradient: "from-purple-500 via-violet-400 to-purple-500",
    count: "Classic",
  },
]

export default function QuickEntryTiles() {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <section className="py-2">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const isHovered = hoveredId === tile.id

          return (
            <Card
              key={tile.id}
              onMouseEnter={() => setHoveredId(tile.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                relative overflow-hidden cursor-pointer transition-all duration-150
                ${isHovered ? "border-accent/70 shadow-md scale-[1.02]" : "border-border/50"}
                bg-card/60 backdrop-blur-sm rounded-md
              `}
            >
              <div className="relative p-1.5 h-[72px] md:h-[80px] flex flex-col items-center justify-center text-center space-y-1">
                <div
                  className={`
                    w-7 h-7 rounded-md flex items-center justify-center
                    bg-gradient-to-br ${tile.gradient}
                    transition-transform duration-150
                    ${isHovered ? "scale-110" : ""}
                  `}
                >
                  <Icon className="w-[18px] h-[18px] text-white" />
                </div>

                <div>
                  <h3 className="text-[11px] md:text-[12px] font-semibold leading-tight">{tile.title}</h3>
                  <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5">{tile.count}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
