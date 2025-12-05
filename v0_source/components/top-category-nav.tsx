"use client"

import { useState } from "react"
import { Home, Trophy, Radio, Dices, Plane, Clapperboard, Hash, Gamepad2, Swords, Monitor, Gift } from "lucide-react"
import { cn } from "@/lib/utils"

const categories = [
  { id: "home", label: "Home", icon: Home },
  { id: "sports", label: "Sports", icon: Trophy },
  { id: "live", label: "Live", icon: Radio },
  { id: "casino", label: "Casino", icon: Dices },
  { id: "aviator", label: "Aviator", icon: Plane },
  { id: "live-casino", label: "Live Casino", icon: Clapperboard },
  { id: "lucky-numbers", label: "Lucky Numbers", icon: Hash },
  { id: "betgames", label: "BetGames", icon: Gamepad2 },
  { id: "esports", label: "Esports", icon: Swords },
  { id: "virtuals", label: "Virtuals", icon: Monitor },
  { id: "promotions", label: "Promotions", icon: Gift },
]

export default function TopCategoryNav() {
  const [activeCategory, setActiveCategory] = useState("home")

  return (
    <div className="sticky top-[38px] md:top-[44px] z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1280px] px-4">
          <div className="flex items-center">
            {categories.map((category) => {
              const Icon = category.icon
              const isActive = activeCategory === category.id

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium transition-all relative",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
                  )}
                >
                  <Icon className="w-[16px] h-[16px]" />
                  <span>{category.label}</span>
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="lg:hidden overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-0.5 px-2 md:px-3 min-w-max">
          {categories.map((category) => {
            const Icon = category.icon
            const isActive = activeCategory === category.id

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "flex items-center gap-1 px-2 md:px-2.5 h-9 md:h-9 text-[11px] md:text-[12px] font-medium transition-all whitespace-nowrap relative",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="w-[14px] md:w-[15px] h-[14px] md:h-[15px]" />
                <span>{category.label}</span>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
