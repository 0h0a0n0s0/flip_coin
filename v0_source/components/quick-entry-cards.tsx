"use client"

import { Card } from "@/components/ui/card"
import { Hash, Sparkles, Trophy, Video } from "lucide-react"
import { useState } from "react"

const categories = [
  {
    id: "hash",
    title: "Hash Games",
    icon: Hash,
    gradient: "from-accent via-accent-secondary to-accent",
    bgGlow: "bg-accent/20",
    description: "Provably Fair",
    featured: true,
  },
  {
    id: "slots",
    title: "Slots",
    icon: Sparkles,
    gradient: "from-primary via-yellow-500 to-primary",
    bgGlow: "bg-primary/20",
    description: "5000+ Games",
    featured: false,
  },
  {
    id: "sports",
    title: "Sports Betting",
    icon: Trophy,
    gradient: "from-green-500 via-emerald-400 to-green-500",
    bgGlow: "bg-green-500/20",
    description: "Live Odds",
    featured: false,
  },
  {
    id: "live",
    title: "Live Casino",
    icon: Video,
    gradient: "from-red-500 via-pink-500 to-red-500",
    bgGlow: "bg-red-500/20",
    description: "Real Dealers",
    featured: false,
  },
]

export default function QuickEntryCards() {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <section className="space-y-6">
      <div className="text-center md:text-left">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Start Playing</h2>
        <p className="text-muted-foreground">Choose your favorite game category</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {categories.map((category) => {
          const Icon = category.icon
          const isHovered = hoveredId === category.id

          return (
            <Card
              key={category.id}
              onMouseEnter={() => setHoveredId(category.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                relative overflow-hidden cursor-pointer border-2 transition-all duration-300
                ${isHovered ? "border-accent scale-105 shadow-2xl" : "border-accent/20"}
                ${category.featured ? "md:col-span-1" : ""}
                bg-card/50 backdrop-blur-sm
              `}
            >
              {/* Glow Effect */}
              <div
                className={`absolute inset-0 ${category.bgGlow} opacity-0 transition-opacity duration-300 ${
                  isHovered ? "opacity-100" : ""
                } blur-xl`}
              />

              {/* Content */}
              <div className="relative p-6 md:p-8 flex flex-col items-center text-center space-y-4">
                {/* Icon with Gradient */}
                <div
                  className={`
                    w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center
                    bg-gradient-to-br ${category.gradient}
                    transform transition-transform duration-300
                    ${isHovered ? "scale-110 rotate-3" : ""}
                  `}
                >
                  <Icon className="w-8 h-8 md:w-10 md:h-10 text-white drop-shadow-lg" />
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <h3 className="text-lg md:text-xl font-bold">{category.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{category.description}</p>
                </div>

                {/* Hover Indicator */}
                {isHovered && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
