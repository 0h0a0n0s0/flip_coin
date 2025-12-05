"use client"

import { Shield, Dices, Spade, CircleDot } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import ProvablyFairModal from "./provably-fair-modal"
import { useState } from "react"

const hashGames = [
  {
    name: "Hash Dice",
    icon: Dices,
    color: "from-accent to-accent/50",
    hash: "0x7f3a2...9c1b",
    players: "1,234",
  },
  {
    name: "Hash Baccarat",
    icon: Spade,
    color: "from-primary to-primary/50",
    hash: "0x9e2d5...4f8a",
    players: "892",
  },
  {
    name: "Block Roulette",
    icon: CircleDot,
    color: "from-accent-secondary to-accent-secondary/50",
    hash: "0x1c4b7...3e9d",
    players: "2,156",
  },
]

export default function HashGamesSection() {
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false)

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Provably Fair Hash Games</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFairnessModalOpen(true)}
            className="hidden md:flex items-center gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
          >
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-primary font-medium">Verify Fairness</span>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {hashGames.map((game) => {
            const Icon = game.icon
            return (
              <Card
                key={game.name}
                className="group relative overflow-hidden border-border/50 bg-secondary/30 backdrop-blur transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 cursor-pointer"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-10 transition-opacity`}
                />

                <div className="relative p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-border/50">
                      <Icon className="h-7 w-7 text-foreground" />
                    </div>
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                      Fair
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-foreground">{game.name}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <code className="rounded bg-secondary px-2 py-1 text-muted-foreground font-mono">
                        {game.hash}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <span className="text-sm text-muted-foreground">Players online</span>
                    <span className="text-sm font-semibold text-primary">{game.players}</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <ProvablyFairModal open={fairnessModalOpen} onOpenChange={setFairnessModalOpen} />
    </>
  )
}
