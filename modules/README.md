flip-coin/
│
├─ index.html              # 网站首页 + 游戏页面
├─ style.css               # 全站样式
├─ app.js                  # 主前端逻辑（钱包连接、下注、游戏结果）
├─ modules/
│   ├─ wallet.js       # 钱包连接 + 用户注册
│   ├─ user.js         # 用户资料管理
│   ├─ game.js         # Flip Coin 核心逻辑
│   ├─ deposit.js      # 入金与余额管理
│   ├─ history.js      # 投注历史管理
│   └─ utils.js        # 公用函数（hash解析、随机ID等）
└─ README.md
