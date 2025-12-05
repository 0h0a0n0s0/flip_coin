import Header from "@/components/header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import TopCategoryNav from "@/components/top-category-nav"
import LeftSidebarMenu from "@/components/left-sidebar-menu"
import CompactHeroStrip from "@/components/compact-hero-strip"
import TrendingGamesGrid from "@/components/trending-games-grid"
import SmallWinnerTicker from "@/components/small-winner-ticker"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {/* Header - same on mobile and desktop */}
      <Header />

      {/* Top category nav - scrollable on mobile, full bar on desktop */}
      <TopCategoryNav />

      {/* Main layout with left sidebar */}
      <div className="flex">
        {/* Left sidebar - drawer on mobile (<lg), fixed sidebar on desktop (≥lg) */}
        <LeftSidebarMenu />

        {/* Main content - same structure on all screens */}
        <main className="flex-1 min-w-0">
          {/* Hero strip - responsive height */}
          <CompactHeroStrip />

          <div className="mx-auto max-w-[1280px] px-3 md:px-4 lg:px-6 space-y-3">
            {/* Trending games - 2 cols mobile, 4-5 cols desktop */}
            <TrendingGamesGrid />

            {/* Winner ticker - same on all screens */}
            <SmallWinnerTicker />
          </div>
        </main>
      </div>

      {/* Footer - stack vertically on mobile */}
      <Footer />

      {/* Mobile bottom nav - only on mobile */}
      <MobileBottomNav />
    </div>
  )
}
