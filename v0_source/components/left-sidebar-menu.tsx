"use client"

import { useState } from "react"
import {
  Search,
  LayoutGrid,
  TrendingUp,
  Sparkles,
  DollarSign,
  TrendingDown,
  Zap,
  Hand,
  Ticket,
  CircleDot,
  Wifi,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const menuItems = [
  { id: "all", label: "All Games", icon: LayoutGrid },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "new", label: "New", icon: Sparkles },
  { id: "slots", label: "Slots", icon: DollarSign },
  { id: "crash", label: "Crash Games", icon: TrendingDown },
  { id: "quick", label: "Quick Games", icon: Zap },
  { id: "tap", label: "Tap Games", icon: Hand },
  { id: "scratch", label: "Scratch Cards", icon: Ticket },
  { id: "bingo", label: "Bingo", icon: CircleDot },
  { id: "lowdata", label: "Low Data Games", icon: Wifi },
]

export default function LeftSidebarMenu() {
  const [activeItem, setActiveItem] = useState("all")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const MenuContent = () => (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full justify-start h-7 px-1.5 hidden md:flex"
      >
        <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform", isCollapsed && "rotate-180")} />
        {!isCollapsed && <span className="ml-1.5 text-[11px]">Collapse</span>}
      </Button>

      {!isCollapsed && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="h-7 pl-7 bg-secondary/50 border-border/50 text-[11px] rounded-lg"
          />
        </div>
      )}

      <nav className="space-y-0.5 pt-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveItem(item.id)
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 h-8 rounded-lg text-[13px] font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>
    </>
  )

  return (
    <>
      <aside
        className={cn(
          "hidden lg:block sticky top-[88px] h-[calc(100vh-88px)] border-r border-border/40 bg-background/60 backdrop-blur transition-all duration-300 overflow-y-auto scrollbar-thin",
          isCollapsed ? "w-[54px]" : "w-[200px]",
        )}
      >
        <div className="p-2 space-y-1.5">
          <MenuContent />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed left-3 top-[100px] z-40 h-9 w-9 rounded-full bg-background/95 backdrop-blur border border-border/50 shadow-lg"
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetHeader className="px-3 py-2.5 border-b border-border/40">
            <SheetTitle className="text-sm">Game Categories</SheetTitle>
          </SheetHeader>
          <div className="p-3 space-y-1.5">
            <MenuContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
