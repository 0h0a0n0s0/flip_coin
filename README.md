flip_coin_v2/
├── admin-ui/         <-- (新增) v2 後台前端 (Vue.js + Element Plus)
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── router/
│   │   ├── views/      <-- 仪表板、用户管理、投注管理等页面
│   │   └── ...
│   ├── Dockerfile      <-- (新增) 用于打包 Vue 专案
│   └── package.json
│
├── backend/          <-- v1 後端 (Node.js + Express)
│   ├── routes/         <-- (新增) 存放路由逻辑
│   │   ├── admin.js    <-- (新增) 後台 API 路由
│   │   └── app.js      <-- v1 dApp API 路由
│   ├── middleware/     <-- (新增)
│   │   └── auth.js     <-- (新增) 後台 API 身份验证
│   ├── server.js       <-- (修改) 引用 routes/
│   ├── db.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/         <-- v1 dApp 前台 (纯 JS)
│   ├── modules/
│   ├── app.js
│   ├── config.js
│   ├── index.html
│   └── style.css
│
├── db_data/            <-- v1 资料库数据 (Volume)
│
├── docker-compose.yml  <-- (修改) 新增 admin-ui 服务，并让 nginx/caddy 代理
├── init.sql            <-- (修改) 可能需要为後台新增管理员帐号表
└── .gitignore