"use client"

import {
  X,
  Crown,
  Users,
  Gift,
  MessageCircle,
  Shield,
  Globe,
  Trophy,
  Target,
  Zap,
  Lock,
  ChevronDown,
  LayoutGrid,
  TrendingUp,
  Sparkles,
  DollarSign,
  TrendingDown,
  Hand,
  Ticket,
  CircleDot,
  Wifi,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ProvablyFairModal from "./provably-fair-modal"
import { useState } from "react"

interface SidebarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigationItems = [
  { icon: Crown, label: "VIP Club", id: "vip", badge: "VIP3" },
  { icon: Users, label: "Affiliate / Agent", id: "affiliate", highlight: true },
  { icon: Gift, label: "Promotions", id: "promotions", badge: "HOT" },
  { icon: Trophy, label: "Leaderboards", id: "leaderboards" },
  { icon: Target, label: "Daily Missions", id: "missions", badge: "NEW" },
  { icon: Zap, label: "Jackpot Tracker", id: "jackpot" },
  { icon: Lock, label: "VIP Exclusive Games", id: "vip-games" },
  { icon: MessageCircle, label: "Live Support", id: "support" },
  { icon: Shield, label: "Fairness Verification", id: "fairness" },
]

const gameCategories = [
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

export default function SidebarDrawer({ open, onOpenChange }: SidebarDrawerProps) {
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false)
  const [gameCategoriesExpanded, setGameCategoriesExpanded] = useState(false)
  const [activeGameCategory, setActiveGameCategory] = useState("all")

  const handleNavClick = (id: string) => {
    if (id === "fairness") {
      setFairnessModalOpen(true)
      onOpenChange(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm md:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-80 bg-card/95 backdrop-blur-xl border-r border-border/50 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-secondary">
                <div className="text-base font-bold text-foreground">#</div>
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">FairHash</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Info Summary */}
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 border-2 border-primary">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user123" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-lg font-bold">
                  JD
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-base font-semibold text-foreground">John Doe</div>
                <div className="text-sm text-muted-foreground">ID: 12345678</div>
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/50">
                  <Crown className="h-3 w-3 text-primary" />
                  <span className="text-xs font-bold text-primary">VIP 3</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation List */}
          <nav className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              <div className="border-b border-border/30 pb-1 mb-1">
                <button
                  onClick={() => setGameCategoriesExpanded(!gameCategoriesExpanded)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-secondary/50"
                >
                  <LayoutGrid className="h-5 w-5 text-foreground" />
                  <span className="flex-1 text-left font-medium text-foreground">Game Categories</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      gameCategoriesExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {gameCategoriesExpanded && (
                  <div className="mt-1 space-y-0.5 pl-2">
                    {gameCategories.map((category) => {
                      const Icon = category.icon
                      const isActive = activeGameCategory === category.id

                      return (
                        <button
                          key={category.id}
                          onClick={() => setActiveGameCategory(category.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{category.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      item.highlight
                        ? "bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/50 hover:from-primary/30 hover:to-accent/30"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${item.highlight ? "text-primary" : "text-foreground"}`} />
                    <span
                      className={`flex-1 text-left font-medium ${item.highlight ? "text-primary" : "text-foreground"}`}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          item.badge === "HOT" ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Language Switcher at Bottom */}
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <Select defaultValue="en">
                <SelectTrigger className="flex-1 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border/50">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Provably Fair modal */}
      <ProvablyFairModal open={fairnessModalOpen} onOpenChange={setFairnessModalOpen} />
    </>
  )
}
