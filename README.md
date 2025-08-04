
# 💸 Discord Marketplace Bot

A simple Discord bot with a user marketplace system — built with [discord.js](https://discord.js.org/), [Drizzle ORM](https://orm.drizzle.team/), and PostgreSQL. Users can register, manage wallets, send money, and buy/sell items.

## 🚀 Features

- **User registration**  
  ![register](images/register.png)

- **Wallet system (balance, add/remove money)**  
  ![balance](images/balance.png)  
  ![addmoney](images/addmoney.png)  
  ![removemoney](images/removemoney.png)

- **Peer-to-peer money transfer**  
  ![transfer](images/transfer.png)

- **Item marketplace (buy/sell)**  
  ![buy](images/buy.png)  
  ![sell](images/sell.png)

- **Admin-only commands**

---

## 🧰 Tech Stack

- [Node.js](https://nodejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [discord.js](https://discord.js.org/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [PostgreSQL](https://www.postgresql.org/)
- [dotenv](https://www.npmjs.com/package/dotenv)

---

## 📦 Setup

### 1. Clone the Repo

```bash
git clone https://github.com/TanzimKShanto/discord-marketplace-bot.git
cd discord-marketplace-bot

```

### 2. Install Dependencies

```bash

pnpm install
# or
npm install

```

### 3. Create your .env File

```bash
cp .env.example .env

```

Edit .env and add your own tokens:

```bash
DISCORD_TOKEN=your-discord-bot-token
DATABASE_URL=postgres://username:password@localhost:5432/dbname

```

### 4. Set Up the Database

Initialize your schema and generate migration files:

```bash
pnpm drizzle:push     # push schema to DB
pnpm drizzle:generate # generate types

```

(Commands may vary depending on how your scripts are set.)

### 5. Run the Bot

```bash

pnpm dev
# or
npm run dev

```

## scripts

```json
{
  "dev": "ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "drizzle:generate": "drizzle-kit generate:pg",
  "drizzle:push": "drizzle-kit push:pg"
}

```

## 🤖 Example Commands

```
!register                  → Register your wallet
!balance                   → Check your balance
!addmoney @user 100        → Admin: add money to a user
!send @user 50             → Send money to another user
!buy item_name             → Buy an item from marketplace
!additem item_name price   → List an item for sale
!shop                      → View items for sale
!inventory                 → View your inventory
```

## 👨‍💻 Author

[Tanzim K Shanto](https://github.com/TanzimKShanto)
