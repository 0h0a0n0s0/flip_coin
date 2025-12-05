"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Zap, Globe } from "lucide-react"
import { useEffect, useState } from "react"

export default function HeroSection() {
  const [gasPrice, setGasPrice] = useState(23)
  const [btcFee, setBtcFee] = useState(15)

  useEffect(() => {
    const interval = setInterval(() => {
      setGasPrice((prev) => prev + Math.floor(Math.random() * 3) - 1)
      setBtcFee((prev) => prev + Math.floor(Math.random() * 2) - 1)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-accent/5 to-background">
      {/* Layer 1: Particle Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.1),rgba(255,255,255,0))]" />
      </div>

      {/* Layer 2: Neon Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse delay-500" />

      {/* Layer 3: Content */}
      <div className="relative container mx-auto px-4 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left: Main Headline */}
          <div className="space-y-6 text-center md:text-left">
            <Badge className="bg-accent/20 text-accent-foreground border-accent/50 backdrop-blur-sm">
              <Zap className="w-3 h-3 mr-1" />
              Provably Fair Hash Games
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-balance">
              Win Big with
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-accent-secondary animate-gradient">
                Crypto Fairness
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-xl mx-auto md:mx-0">
              Transparent blockchain-based gaming with instant payouts. Every bet is verifiable, every win is
              guaranteed.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button
                size="lg"
                className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/50"
              >
                Sign Up Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 border-accent/50 hover:bg-accent/10 bg-transparent"
              >
                Quick Demo
              </Button>
            </div>
          </div>

          {/* Right: Hot Events & Network Status */}
          <div className="space-y-4">
            {/* Daily Hot Sports Events */}
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Live Sports Betting</h3>
                    <Badge variant="destructive" className="animate-pulse">
                      LIVE
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Premier League: Man City vs Arsenal</p>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-accent/20 text-accent-foreground">15,234 bets</span>
                    <span className="px-2 py-1 rounded bg-primary/20 text-primary-foreground">$2.5M pool</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Blockchain Network Status */}
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-accent/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-secondary to-accent flex items-center justify-center shrink-0">
                  <Globe className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-3">Network Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">ETH Gas Price</span>
                      <span className="font-mono font-semibold text-accent-secondary animate-pulse">
                        {gasPrice} Gwei
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">BTC Fee Rate</span>
                      <span className="font-mono font-semibold text-primary animate-pulse">{btcFee} sat/vB</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom Fog/Blur Layer */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}
