"use client"

import { Card } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import { useEffect, useState } from "react"

export default function JackpotMeter() {
  const [jackpot, setJackpot] = useState(1234567.89)

  useEffect(() => {
    const interval = setInterval(() => {
      setJackpot((prev) => prev + Math.random() * 10)
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-yellow-500/10 via-yellow-600/10 to-yellow-500/10 border-yellow-500/30">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent animate-pulse" />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/50 animate-pulse">
              <Trophy className="w-8 h-8 text-yellow-900" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Progressive Jackpot</div>
              <div className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 font-mono">
                ${jackpot.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="text-center md:text-right">
            <div className="text-sm text-muted-foreground mb-2">Last Winner</div>
            <div className="font-semibold">Player****3829</div>
            <div className="text-xs text-yellow-500">Won $156,234.50</div>
          </div>
        </div>

        {/* Progress bar animation */}
        <div className="mt-4 h-2 bg-background/50 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 animate-pulse w-3/4" />
        </div>
      </div>
    </Card>
  )
}
