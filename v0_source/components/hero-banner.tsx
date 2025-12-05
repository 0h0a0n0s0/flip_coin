"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const banners = [
  {
    id: 1,
    title: "Welcome Bonus",
    subtitle: "100% First Deposit Bonus",
    description: "Get up to $5,000 USDT on your first deposit",
    gradient: "from-primary/20 via-accent/20 to-accent-secondary/20",
  },
  {
    id: 2,
    title: "VIP Rewards",
    subtitle: "Exclusive Benefits",
    description: "Join our VIP program and earn cashback & prizes",
    gradient: "from-accent-secondary/20 via-primary/20 to-accent/20",
  },
  {
    id: 3,
    title: "Daily Challenges",
    subtitle: "Win Every Day",
    description: "Complete daily tasks and earn bonus rewards",
    gradient: "from-accent/20 via-accent-secondary/20 to-primary/20",
  },
]

export default function HeroBanner() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-secondary/30 backdrop-blur">
      <div className="relative aspect-[21/9] md:aspect-[21/6]">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              className={`h-full w-full bg-gradient-to-br ${banner.gradient} p-8 md:p-12 flex flex-col justify-center`}
            >
              <div className="max-w-2xl space-y-2 md:space-y-4">
                <div className="text-xs md:text-sm font-medium text-primary uppercase tracking-wider">
                  {banner.subtitle}
                </div>
                <h2 className="text-2xl md:text-5xl font-bold text-foreground text-balance">{banner.title}</h2>
                <p className="text-sm md:text-lg text-muted-foreground text-pretty">{banner.description}</p>
                <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">Claim Now</Button>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Buttons */}
        <Button
          variant="ghost"
          size="icon"
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/70 backdrop-blur"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/70 backdrop-blur"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        {/* Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentSlide ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
