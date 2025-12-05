"use client"

import { useState } from "react"
import { QrCode, AlertCircle, Copy, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface WalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const [selectedChain, setSelectedChain] = useState("TRC20")
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [copied, setCopied] = useState(false)

  // Mock wallet address and balance
  const walletAddress = "TYWGmj3zxKEfJYwSQJvNjzr8xPZHJvDRXx"
  const availableBalance = 1250.0
  const minDeposit = 10

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[420px] max-w-full bg-card/95 backdrop-blur-xl border border-border/50 p-0 gap-0 
        max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:max-h-[70vh] max-sm:overflow-y-auto"
      >
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/30">
          <DialogTitle className="text-lg font-semibold text-foreground">Wallet</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50 h-9 p-0.5 mt-3 mb-4">
              <TabsTrigger
                value="deposit"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm h-8"
              >
                Deposit
              </TabsTrigger>
              <TabsTrigger
                value="withdraw"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm h-8"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>

            {/* Deposit Tab */}
            <TabsContent value="deposit" className="space-y-3.5 mt-0">
              {/* Chain Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="chain" className="text-foreground text-sm">
                  Select Crypto Chain
                </Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger id="chain" className="bg-secondary/50 border-border/50 h-9 text-sm">
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50">
                    <SelectItem value="TRC20">USDT (TRC20)</SelectItem>
                    <SelectItem value="ERC20">USDT (ERC20)</SelectItem>
                    <SelectItem value="BEP20">USDT (BEP20)</SelectItem>
                    <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                    <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* QR Code Area */}
              <div className="flex justify-center py-3">
                <div className="relative p-2.5 rounded-[10px] bg-white">
                  <div className="w-[116px] h-[116px] sm:w-[132px] sm:h-[132px] flex items-center justify-center bg-gradient-to-br from-accent to-accent-secondary rounded-lg">
                    <QrCode className="w-20 h-20 sm:w-24 sm:h-24 text-white" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[11px] font-bold px-2 py-0.5 rounded-full h-[22px] flex items-center">
                    {selectedChain}
                  </div>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Deposit Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={walletAddress}
                    readOnly
                    className="bg-secondary/50 border-border/50 text-foreground font-mono text-xs h-9 truncate"
                  />
                  <Button
                    onClick={handleCopy}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-3 min-w-[68px] text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Done
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Warning */}
              <Alert className="bg-destructive/10 border-destructive/50 py-2 px-3">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <AlertDescription className="text-foreground text-xs leading-tight ml-6">
                  <strong className="font-semibold">Min: ${minDeposit}</strong> • Only send {selectedChain}. Other
                  assets may be lost permanently.
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* Withdraw Tab */}
            <TabsContent value="withdraw" className="space-y-3.5 mt-0">
              {/* Available Balance */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
                <div className="text-xs text-muted-foreground mb-0.5">Available Balance</div>
                <div className="text-2xl font-bold text-foreground">${availableBalance.toFixed(2)}</div>
              </div>

              {/* Chain Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-chain" className="text-foreground text-sm">
                  Select Crypto Chain
                </Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger id="withdraw-chain" className="bg-secondary/50 border-border/50 h-9 text-sm">
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50">
                    <SelectItem value="TRC20">USDT (TRC20)</SelectItem>
                    <SelectItem value="ERC20">USDT (ERC20)</SelectItem>
                    <SelectItem value="BEP20">USDT (BEP20)</SelectItem>
                    <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                    <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Withdraw Address */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-foreground text-sm">
                  Withdrawal Address
                </Label>
                <Input
                  id="address"
                  placeholder="Enter wallet address"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="bg-secondary/50 border-border/50 font-mono text-xs h-9"
                />
              </div>

              {/* Withdraw Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount" className="text-foreground text-sm">
                    Amount
                  </Label>
                  <button
                    onClick={() => setWithdrawAmount(availableBalance.toString())}
                    className="text-[11px] text-primary hover:text-primary/80 font-semibold"
                  >
                    MAX
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="bg-secondary/50 border-border/50 pr-14 h-9 text-sm"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                    USDT
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-sm mt-1">
                Withdraw
              </Button>

              {/* Info */}
              <Alert className="bg-muted/30 border-border/50 py-2 px-3">
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
                <AlertDescription className="text-foreground text-[11px] leading-tight ml-6">
                  Min: $20 • Processing: 5-30 min • Network fee deducted
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
