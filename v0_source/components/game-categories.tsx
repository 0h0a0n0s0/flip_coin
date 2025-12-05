import { Trophy, Gamepad2, Video, Zap, Fish } from "lucide-react"
import { Card } from "@/components/ui/card"

const categories = [
  { name: "Sports", icon: Trophy, gradient: "from-accent to-accent/50" },
  { name: "Board Games", icon: Gamepad2, gradient: "from-primary to-primary/50" },
  { name: "Live Casino", icon: Video, gradient: "from-accent-secondary to-accent-secondary/50" },
  { name: "Slots", icon: Zap, gradient: "from-accent to-accent/50" },
  { name: "Fishing", icon: Fish, gradient: "from-primary to-primary/50" },
]

export default function GameCategories() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Game Categories</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {categories.map((category) => {
          const Icon = category.icon
          return (
            <Card
              key={category.name}
              className="group relative overflow-hidden border-border/50 bg-secondary/30 backdrop-blur transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 cursor-pointer"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-20 transition-opacity`}
              />

              <div className="relative p-6 flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/50 group-hover:scale-110 transition-transform">
                  <Icon className="h-8 w-8 text-foreground" />
                </div>
                <span className="font-semibold text-foreground text-sm">{category.name}</span>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
