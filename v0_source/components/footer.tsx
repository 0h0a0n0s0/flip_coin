import { Bitcoin, Wallet } from "lucide-react"

export default function Footer() {
  return (
    <footer className="hidden md:block border-t border-border/40 bg-secondary/20 mt-6">
      <div className="container mx-auto px-4 py-4">
        <div className="grid gap-4 md:grid-cols-3">
          {/* About */}
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[13px] text-foreground">About FairHash</h3>
            <p className="text-[11px] text-muted-foreground text-pretty">
              The most transparent and fair crypto gambling platform powered by blockchain technology.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[13px] text-foreground">Quick Links</h3>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li className="hover:text-primary transition-colors cursor-pointer">Fairness Verification</li>
              <li className="hover:text-primary transition-colors cursor-pointer">Terms & Conditions</li>
              <li className="hover:text-primary transition-colors cursor-pointer">Responsible Gaming</li>
              <li className="hover:text-primary transition-colors cursor-pointer">Help Center</li>
            </ul>
          </div>

          {/* Payment Methods */}
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[13px] text-foreground">Accepted Payments</h3>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1 border border-border/50">
                <Bitcoin className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium text-foreground">BTC</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1 border border-border/50">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium text-foreground">USDT</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1 border border-border/50">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium text-foreground">ETH</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-3 pt-3 border-t border-border/30 text-center text-[10px] text-muted-foreground">
          <p>© 2025 FairHash. Licensed and regulated. Play responsibly.</p>
        </div>
      </div>
    </footer>
  )
}
