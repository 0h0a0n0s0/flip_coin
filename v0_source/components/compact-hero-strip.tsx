"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Zap, Trophy } from "lucide-react"
import Image from "next/image"

export default function CompactHeroStrip() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-primary/20 via-accent/20 to-accent-secondary/20 border-b border-border/50">
      {/* Background with overlay */}
      <div className="absolute inset-0">
        <Image
          src="/.jpg?height=220&width=1400&query=luxury casino background with neon lights and crypto symbols"
          alt="Casino banner"
          fill
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
      </div>

      {/* Accent blobs */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/40 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-3 md:px-4 h-[140px] md:h-[180px] flex items-center">
        <div className="grid md:grid-cols-[1fr_auto] gap-4 md:gap-6 w-full items-center">
          {/* Left Content */}
          <div className="space-y-2 md:space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="bg-accent/30 text-accent-foreground border-accent/60 text-[10px] px-1.5 py-0.5 h-5">
                <Zap className="w-2.5 h-2.5 mr-0.5" />
                Provably Fair
              </Badge>
              <Badge className="bg-primary/30 text-primary-foreground border-primary/60 text-[10px] px-1.5 py-0.5 h-5">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                $2.5M Daily Volume
              </Badge>
              <Badge className="bg-green-500/30 text-green-400 border-green-500/60 text-[10px] px-1.5 py-0.5 h-5">
                <Trophy className="w-2.5 h-2.5 mr-0.5" />
                10,000+ Winners Today
              </Badge>
            </div>

            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-balance leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-accent-secondary">
                Win Big
              </span>{" "}
              with Crypto Fairness
            </h1>

            <p className="text-[12px] md:text-[13px] text-muted-foreground text-pretty max-w-xl">
              Transparent blockchain gaming • Instant crypto payouts • Every bet verifiable on-chain
            </p>
          </div>

          {/* Right CTAs */}
          <div className="flex md:flex-col gap-2">
            <Button className="h-9 md:h-11 px-5 md:px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/40 text-[13px] md:text-[14px] font-bold rounded-lg">
              Sign Up Now
            </Button>
            <Button
              variant="outline"
              className="h-9 md:h-11 px-5 md:px-8 border-accent/50 hover:bg-accent/10 bg-background/50 backdrop-blur text-[13px] md:text-[14px] font-semibold rounded-lg"
            >
              Quick Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
