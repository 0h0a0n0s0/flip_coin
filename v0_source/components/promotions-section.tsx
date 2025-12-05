"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gift, Target, Calendar, Star } from "lucide-react"
import Image from "next/image"

const promotions = [
  {
    id: 1,
    title: "Welcome Bonus",
    description: "Get 200% bonus on your first deposit up to $1,000",
    image: "/welcome-bonus-casino-gold-coins.jpg",
    badge: "New Users",
    color: "from-yellow-500 to-yellow-600",
  },
  {
    id: 2,
    title: "First Deposit Guarantee",
    description: "Lose your first deposit? We'll refund 50% up to $500",
    image: "/deposit-guarantee-shield-protection.jpg",
    badge: "Risk-Free",
    color: "from-green-500 to-emerald-600",
  },
]

const missions = [
  { id: 1, title: "Daily Login Streak", reward: "$5 Bonus", progress: 3, total: 7, icon: Calendar },
  { id: 2, title: "Place 10 Bets Today", reward: "$10 Bonus", progress: 6, total: 10, icon: Target },
  { id: 3, title: "Win 5 Hash Games", reward: "$15 Bonus", progress: 2, total: 5, icon: Star },
]

export default function PromotionsSection() {
  return (
    <section className="space-y-8">
      {/* Promotions */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Promotions & Bonuses</h2>
            <p className="text-sm text-muted-foreground">Exclusive offers for you</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {promotions.map((promo) => (
            <Card
              key={promo.id}
              className="group overflow-hidden bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 transition-all duration-300 cursor-pointer"
            >
              <div className="relative aspect-[2/1] overflow-hidden">
                <Image
                  src={promo.image || "/placeholder.svg"}
                  alt={promo.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <Badge className={`absolute top-4 left-4 bg-gradient-to-r ${promo.color} border-0 text-white`}>
                  {promo.badge}
                </Badge>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">{promo.title}</h3>
                  <p className="text-sm text-muted-foreground">{promo.description}</p>
                </div>
                <Button className="w-full bg-gradient-to-r from-accent to-accent-secondary hover:opacity-90">
                  Claim Now
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Daily Missions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">Daily Missions</h3>
            <p className="text-sm text-muted-foreground">Complete tasks to earn rewards</p>
          </div>
          <Badge variant="outline" className="border-accent/50">
            3 Active
          </Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {missions.map((mission) => {
            const Icon = mission.icon
            const progress = (mission.progress / mission.total) * 100

            return (
              <Card
                key={mission.id}
                className="p-4 bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">{mission.title}</h4>
                      <p className="text-xs text-primary">{mission.reward}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>
                        {mission.progress}/{mission.total}
                      </span>
                    </div>
                    <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
