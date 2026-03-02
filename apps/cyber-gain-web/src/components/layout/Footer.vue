<template>
  <!-- Footer 容器：深色背景 -->
  <footer class="w-full bg-[#0B1223] flex justify-center px-4 py-5">
    <!-- 内容区域：最大宽度 500px -->
    <div class="w-full max-w-[500px]">
    <!-- 支持/法律 区块 -->
    <section class="mb-5">
      <h3 class="text-white text-base font-medium mb-3">支持/法律</h3>
      <div class="flex flex-wrap justify-between items-center gap-y-2">
        <a href="#" class="text-[#8A8CA6] text-xs font-medium hover:text-white transition-colors">常见问题</a>
        <a href="#" class="text-[#8A8CA6] text-xs font-medium hover:text-white transition-colors">负责任博彩</a>
        <a href="#" class="text-[#8A8CA6] text-xs font-medium hover:text-white transition-colors">公平公正</a>
        <a href="#" class="text-[#8A8CA6] text-xs font-medium hover:text-white transition-colors">服务条款</a>
        <a href="#" class="text-[#8A8CA6] text-xs font-medium hover:text-white transition-colors">隐私权政策</a>
        <a href="#" class="text-[#8A8CA6] text-xs font-medium hover:text-white transition-colors">关于我们</a>
      </div>
    </section>

    <!-- 分隔线 -->
    <div class="w-full h-px bg-[#1B2A52] mb-5"></div>

    <!-- 社群入口 区块 -->
    <section class="mb-5">
      <h3 class="text-white text-base font-medium mb-3">社群入口</h3>
      <div class="flex justify-between items-center">
        <!-- Telegram -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/telegram_home.png" alt="Telegram" class="w-full h-full object-contain" />
        </a>
        
        <!-- Facebook -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/facebook_home.png" alt="Facebook" class="w-full h-full object-contain" />
        </a>
        
        <!-- YouTube -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/youtube_home.png" alt="YouTube" class="w-full h-full object-contain" />
        </a>
        
        <!-- X (Twitter) -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/x_home.png" alt="X" class="w-full h-full object-contain" />
        </a>
        
        <!-- Instagram -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/instagram_home.png" alt="Instagram" class="w-full h-full object-contain" />
        </a>
        
        <!-- Discord -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/discord_home.png" alt="Discord" class="w-full h-full object-contain" />
        </a>
        
        <!-- TikTok -->
        <a href="#" class="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src="/images/home/tiktok_home.png" alt="TikTok" class="w-full h-full object-contain" />
        </a>
      </div>
    </section>

    <!-- 支持的币种 区块 -->
    <section class="mb-5">
      <h3 class="text-white text-base font-medium mb-3">支持的币种</h3>
      <div class="flex justify-between items-center">
        <!-- USDT -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/tether_home.png" alt="Tether (USDT)" class="w-full h-full object-contain" />
        </div>
        
        <!-- TRON -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/tron_home.png" alt="Tron (TRX)" class="w-full h-full object-contain" />
        </div>
        
        <!-- Ethereum -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/ethereum_home.png" alt="Ethereum (ETH)" class="w-full h-full object-contain" />
        </div>
        
        <!-- Bitcoin -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/bitcoin_home.png" alt="Bitcoin (BTC)" class="w-full h-full object-contain" />
        </div>
        
        <!-- Litecoin -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/litecoin_home.png" alt="Litecoin (LTC)" class="w-full h-full object-contain" />
        </div>
        
        <!-- Binance Coin -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/binance_home.png" alt="Binance Coin (BNB)" class="w-full h-full object-contain" />
        </div>
        
        <!-- Solana -->
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/images/home/solana_home.png" alt="Solana (SOL)" class="w-full h-full object-contain" />
        </div>
      </div>
    </section>

    <!-- 赞助和博彩责任 区块 -->
    <section class="mb-5">
      <h3 class="text-white text-base font-medium mb-3">赞助和博彩责任</h3>
      <div class="flex items-center gap-2.5">
        <!-- GCB 认证标志 -->
        <div class="w-[100px] h-14 flex items-center justify-center">
          <img src="/images/home/gcb_home.png" alt="GCB Certificate" class="w-full h-full object-contain" />
        </div>
        
        <!-- 18+ 标志 -->
        <div class="w-14 h-14 rounded-full border-2 border-gray-600 flex items-center justify-center">
          <span class="text-white text-lg font-bold">18+</span>
        </div>
      </div>
    </section>

    <!-- 分隔线 -->
    <div class="w-full h-px bg-[#1B2A52] mb-5"></div>

    <!-- CYBER GAIN Logo 和公司信息 -->
    <section class="space-y-1.5">
      <!-- Logo -->
      <div class="mb-2">
        <img src="/images/common/platformLogo.svg" alt="CYBER GAIN" class="h-7" />
      </div>

      <!-- 公司信息文本 -->
      <p class="text-[#8A8CA6] text-xs leading-relaxed">
        CYBER GAIN 由 Novisoft N.V. 持有和运营，该公司在库拉索注册，公司编号 163608，注册地址：Zuikertuintjeweg Z/N, Curaçao。 Novisoft N.V. 受库拉索博彩管理委员会（GCB）许可和监管，许可证编号 OGL/2024/1394/0725。该许可证由库拉索政府颁发并监管，确保平台的合法性、安全性与合规性。
      </p>

      <p class="text-[#8A8CA6] text-xs leading-relaxed">
        CYBER GAIN 致力于为所有用户提供安全、可靠、公平的游戏环境。无论是下注、玩老虎机，还是参与真人或其他游戏活动，您都可以放心，CYBER GAIN 坚持诚信运营，为每位玩家提供卓越的游戏体验。
      </p>

      <p class="text-[#8A8CA6] text-xs leading-relaxed">
        信托服务和代理由 <a href="https://igagroup.com" class="underline hover:text-white transition-colors">https://igagroup.com</a> 提供。
      </p>
    </section>
    </div>
  </footer>
</template>

<script setup>
// Footer 组件 - 无需额外逻辑
</script>

<style scoped>
/* 确保 Footer 在页面底部 */
footer {
  margin-top: auto;
}
</style>
