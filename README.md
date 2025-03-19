# HyperWorldFoodBot

A Telegram bot for recipes, food images, and global cuisine exploration using the Hyperbolic API. Use mine at [@HyperWorldFood_bot](https://t.me/HyperWorldFood_bot) or build your own!

## One-Click Installation
Run this command in your terminal (requires Node.js installed):
```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/symfamous/HyperWorldFoodBot/main/setup.sh)"
## After Running

- Edit `HyperWorldFoodBot/.env` and add your Telegram Bot Token from [@BotFather](https://t.me/BotFather).
- Start the bot: `cd HyperWorldFoodBot && node index.js`
- Open Telegram, find your bot, and send your Hyperbolic API key.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14+ recommended)
- A Telegram account
- A [Hyperbolic API key](https://app.hyperbolic.xyz/)

## Manual Setup (Alternative)

- Clone: `git clone https://github.com/symfamous/HyperWorldFoodBot.git`
- Install: `cd HyperWorldFoodBot && npm install`
- Configure `.env` with your `TELEGRAM_BOT_TOKEN`.
- Run: `node index.js`

## License

MIT License
