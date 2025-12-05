"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, TrendingUp, Zap } from "lucide-react"

const dailyLeaders = [
  { rank: 1, player: "CryptoKing****2341", wins: 234, profit: 45620, avatar: "🏆" },
  { rank: 2, player: "MoonShot****8492", wins: 198, profit: 38540, avatar: "🥈" },
  { rank: 3, player: "Diamond****7756", wins: 176, profit: 32180, avatar: "🥉" },
  { rank: 4, player: "HashMaster****1122", wins: 145, profit: 28970, avatar: "👑" },
  { rank: 5, player: "LuckyDice****9823", wins: 132, profit: 25340, avatar: "⭐" },
]

const biggestWins = [
  { player: "Whale****4521", game: "Crash", amount: 125680, multiplier: "127.5x" },
  { player: "HighRoller****7832", game: "Hash Dice", amount: 98450, multiplier: "98.5x" },
  { player: "Lucky****3298", game: "Roulette", amount: 87230, multiplier: "35x" },
  { player: "Champion****5643", game: "Limbo", amount: 76540, multiplier: "76.5x" },
  { player: "Winner****9021", game: "Blackjack", amount: 65890, multiplier: "21x" },
]

export default function LeaderboardsSection() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Leaderboards & Big Wins</h2>
          <p className="text-sm text-muted-foreground">Top performers and biggest wins</p>
        </div>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="daily">
            <TrendingUp className="w-4 h-4 mr-2" />
            Daily Leaders
          </TabsTrigger>
          <TabsTrigger value="wins">
            <Zap className="w-4 h-4 mr-2" />
            Biggest Wins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {dailyLeaders.map((leader) => (
              <Card
                key={leader.rank}
                className={`
                  p-4 bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 transition-all duration-300
                  ${leader.rank <= 3 ? "border-primary/50 bg-primary/5" : ""}
                `}
              >
                <div className="text-center space-y-3">
                  <div className="text-4xl">{leader.avatar}</div>
                  <Badge variant={leader.rank === 1 ? "default" : "outline"} className="text-xs">
                    #{leader.rank}
                  </Badge>
                  <div className="space-y-1">
                    <div className="font-semibold text-sm truncate">{leader.player}</div>
                    <div className="text-xs text-muted-foreground">{leader.wins} wins</div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground">Profit</div>
                    <div className="text-lg font-bold text-primary">+${leader.profit.toLocaleString()}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="wins" className="mt-6">
          <div className="space-y-3">
            {biggestWins.map((win, index) => (
              <Card
                key={index}
                className="p-4 bg-card/50 backdrop-blur-sm border-accent/20 hover:border-accent/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{win.player}</div>
                      <div className="text-sm text-muted-foreground">{win.game}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-bold text-primary">${win.amount.toLocaleString()}</div>
                    <Badge variant="outline" className="mt-1 border-accent/50">
                      {win.multiplier}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
