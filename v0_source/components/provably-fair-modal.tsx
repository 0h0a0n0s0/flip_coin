"use client"

import { useState } from "react"
import { Shield, Hash, Check, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ProvablyFairModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ProvablyFairModal({ open, onOpenChange }: ProvablyFairModalProps) {
  const [serverSeed, setServerSeed] = useState("")
  const [clientSeed, setClientSeed] = useState("")
  const [nonce, setNonce] = useState("")
  const [calculatedHash, setCalculatedHash] = useState("")
  const [result, setResult] = useState("")
  const [verified, setVerified] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleVerify = () => {
    if (!serverSeed || !clientSeed || !nonce) {
      return
    }

    // Mock verification - in real app, this would use actual hash algorithm
    const mockHash = `sha256:${serverSeed.substring(0, 8)}${clientSeed.substring(0, 8)}${nonce}abcdef123456789`
    const mockResult = (Number.parseInt(mockHash.substring(mockHash.length - 4), 16) % 10000) / 100

    setCalculatedHash(mockHash.toUpperCase())
    setResult(mockResult.toFixed(2))
    setVerified(true)
  }

  const handleCopyHash = () => {
    navigator.clipboard.writeText(calculatedHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setServerSeed("")
    setClientSeed("")
    setNonce("")
    setCalculatedHash("")
    setResult("")
    setVerified(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-xl border border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-accent-secondary">
              <Shield className="h-5 w-5 text-foreground" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Provably Fair Verifier</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Verify the fairness of any game round by entering the seeds and nonce below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Input Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-seed" className="text-foreground flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Server Seed (Hashed)
              </Label>
              <Input
                id="server-seed"
                placeholder="e.g., 9c5a3d7f2b8e4a1c..."
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-seed" className="text-foreground flex items-center gap-2">
                <Hash className="h-4 w-4 text-accent" />
                Client Seed
              </Label>
              <Input
                id="client-seed"
                placeholder="e.g., user-defined-seed-123"
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nonce" className="text-foreground flex items-center gap-2">
                <Hash className="h-4 w-4 text-accent-secondary" />
                Nonce
              </Label>
              <Input
                id="nonce"
                type="number"
                placeholder="e.g., 1234"
                value={nonce}
                onChange={(e) => setNonce(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono text-sm"
              />
            </div>
          </div>

          {/* Verify Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={!serverSeed || !clientSeed || !nonce}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12"
            >
              <Shield className="h-4 w-4 mr-2" />
              Verify
            </Button>
            {verified && (
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-border/50 hover:bg-secondary/50 bg-transparent"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Output Area */}
          {verified && (
            <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-muted/50 to-secondary/50 border border-border/50">
              <div className="flex items-center gap-2 text-primary">
                <Check className="h-5 w-5" />
                <span className="font-semibold">Verification Complete</span>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground text-xs uppercase tracking-wide">Calculated Hash</Label>
                <div className="relative">
                  <div className="p-3 rounded bg-black/30 border border-border/30">
                    <code className="text-xs text-accent-secondary break-all font-mono leading-relaxed">
                      {calculatedHash}
                    </code>
                  </div>
                  <Button
                    onClick={handleCopyHash}
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1 h-7 w-7 p-0"
                  >
                    {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground text-xs uppercase tracking-wide">Result</Label>
                <div className="p-4 rounded bg-black/30 border border-primary/30 text-center">
                  <div className="text-4xl font-bold text-primary font-mono">{result}</div>
                </div>
              </div>
            </div>
          )}

          {/* Info Alert */}
          <Alert className="bg-accent/10 border-accent/30">
            <Shield className="h-4 w-4 text-accent" />
            <AlertDescription className="text-foreground text-xs leading-relaxed">
              <strong>How it works:</strong> The server generates a random seed (kept secret until round ends), you
              provide a client seed, and together with the nonce (bet number), they create a verifiable hash that
              determines the outcome. This ensures complete transparency and fairness.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  )
}
