import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"

const activities = [
  { user: "User***888", game: "Hash Dice", bet: "100", win: "5,000", time: "2m ago" },
  { user: "Player***123", game: "Hash Baccarat", bet: "500", win: "12,500", time: "5m ago" },
  { user: "Lucky***456", game: "Block Roulette", bet: "250", win: "8,200", time: "8m ago" },
  { user: "Winner***789", game: "Sports", bet: "300", win: "3,750", time: "12m ago" },
  { user: "King***999", game: "Hash Dice", bet: "1,000", win: "15,000", time: "15m ago" },
]

export default function LiveActivityFeed() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Live Activity</h2>
      </div>

      <Card className="border-border/50 bg-secondary/30 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Game
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bet
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Win
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {activities.map((activity, index) => (
                <tr key={index} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{activity.user}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      {activity.game}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">${activity.bet}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-primary">${activity.win}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground hidden md:table-cell">
                    {activity.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
