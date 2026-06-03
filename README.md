# PotatFarmer

### Config

- Rename env.example to .env
- Paste bearer token from potat.app

### How to use

```
git clone https://github.com/cqttv/PotatFarmer.git
cd /PotatFarmer
npm install
npm run build
npm run start
```

### Balance protection

Avoids risky or paid commands when balance is low or when it should be saving for rank progress.

### For PM2

```
npm run start:pm2
pm2 logs PotatFarmer
```
