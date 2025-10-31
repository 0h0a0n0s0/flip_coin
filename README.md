flip_coin_v2/
├── admin-ui/         <-- (新增) v2 後台前端 (Vue.js + Element Plus)
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── router/
│   │   ├── views/      <-- 儀表板、用戶管理、投注管理等頁面
│   │   └── ...
│   ├── Dockerfile      <-- (新增) 用於打包 Vue 專案
│   └── package.json
│
├── backend/          <-- v1 後端 (Node.js + Express)
│   ├── routes/         <-- (新增) 存放路由邏輯
│   │   ├── admin.js    <-- (新增) 後台 API 路由
│   │   └── app.js      <-- v1 dApp API 路由
│   ├── middleware/     <-- (新增)
│   │   └── auth.js     <-- (新增) 後台 API 身份驗證
│   ├── server.js       <-- (修改) 引用 routes/
│   ├── db.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/         <-- v1 dApp 前台 (純 JS)
│   ├── modules/
│   ├── app.js
│   ├── config.js
│   ├── index.html
│   └── style.css
│
├── db_data/            <-- v1 資料庫數據 (Volume)
│
├── docker-compose.yml  <-- (修改) 新增 admin-ui 服務，並讓 nginx/caddy 代理
├── init.sql            <-- (修改) 可能需要為後台新增管理員帳號表
└── .gitignore