"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Info, ExternalLink } from "lucide-react"
import { useState } from "react"
import ProvablyFairModal from "./provably-fair-modal"

export default function ProvablyFairPanel() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Provably Fair & Security</h2>
            <p className="text-sm text-muted-foreground">Transparent blockchain-based verification</p>
          </div>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-green-500/30">
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Server Seed Hash */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="w-4 h-4" />
                  Server Seed Hash
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <code className="text-xs font-mono text-green-500 break-all">a8f5f167f44f4964e6c998dee827110c</code>
                </div>
              </div>

              {/* Client Seed */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="w-4 h-4" />
                  Client Seed
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <code className="text-xs font-mono text-accent break-all">8b9f3a2e7d1c4f0e9b6a5d8c2e7f1a4b</code>
                </div>
              </div>

              {/* Nonce */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="w-4 h-4" />
                  Current Nonce
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <code className="text-xs font-mono text-primary">#12847</code>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border">
              <Button onClick={() => setShowModal(true)} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
                <Shield className="w-4 h-4 mr-2" />
                Verify Fairness
              </Button>
              <Button variant="outline" className="flex-1 border-green-500/50 hover:bg-green-500/10 bg-transparent">
                <ExternalLink className="w-4 h-4 mr-2" />
                How It Works
              </Button>
            </div>

            <div className="text-sm text-muted-foreground text-center pt-2">
              Every game result is cryptographically verifiable. Our provably fair system ensures complete transparency.
            </div>
          </div>
        </Card>
      </section>

      <ProvablyFairModal open={showModal} onOpenChange={setShowModal} />
    </>
  )
}
