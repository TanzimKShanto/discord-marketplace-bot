import 'dotenv/config';

import { Client, GatewayIntentBits } from 'discord.js';
import { db } from './db/index.js';
import { users, items, userItems } from './db/schema.js';
import { eq } from 'drizzle-orm';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
})


client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.content.startsWith('!')) return;

  const args = msg.content.slice(1).trim().split(' ');
  const command = args.shift()?.toLowerCase();

  const discordId = msg.author.id;

  if (command === 'register') {
    const existing = await db.select().from(users).where(eq(users.discordId, discordId));
    if (existing.length) {
      return msg.reply('You are already registered!');
    }

    await db.insert(users).values({ discordId, balance: 1000 });
    msg.reply('Registered with 1000 coins!');
  }

  else if (command === 'balance') {
    const user = await db.select().from(users).where(eq(users.discordId, discordId)).then(r => r[0]);
    if (!user) return msg.reply('You are not registered.');

    msg.reply(`Your balance is 💰 ${user.balance}`);
  }

  else if (command === 'addmoney') {
    if (!msg.member?.permissions.has('Administrator')) return msg.reply('Only admins can do this.');

    const mentioned = msg.mentions.users.first();
    const amount = parseInt(args[1] ?? '0');

    if (!mentioned || isNaN(amount)) return msg.reply('Usage: !addmoney @user amount');

    const user = await db.select().from(users).where(eq(users.discordId, mentioned.id)).then(r => r[0]);
    if (!user) return msg.reply('User not registered.');

    await db.update(users).set({ balance: user.balance + amount }).where(eq(users.discordId, mentioned.id));
    msg.reply(`Added 💰 ${amount} to ${mentioned.username}`);
  }
  else if (command === 'additem') {
    if (!msg.member?.permissions.has('Administrator')) return msg.reply('Only admins can add items.');

    const [name, priceStr] = args;
    const price = parseInt(priceStr ?? '0');

    if (!name || isNaN(price)) return msg.reply('Usage: !additem <name> <price>');

    const existing = await db.select().from(items).where(eq(items.name, name.toLowerCase()));
    if (existing.length > 0) return msg.reply('Item already exists.');

    await db.insert(items).values({ name: name.toLowerCase(), price });
    msg.reply(`✅ Added item **${name}** with price 💰 ${price}`);
  }

  else if (command === 'send') {
    const mentioned = msg.mentions.users.first();
    const amount = parseInt(args[1] ?? '0');

    if (!mentioned || isNaN(amount)) return msg.reply('Usage: !send @user amount');

    const sender = await db.select().from(users).where(eq(users.discordId, discordId)).then(r => r[0]);
    const receiver = await db.select().from(users).where(eq(users.discordId, mentioned.id)).then(r => r[0]);

    if (!sender || !receiver) return msg.reply('Both users must be registered.');
    if (sender.balance < amount) return msg.reply('Insufficient balance.');

    await db.transaction(async (tx) => {
      await tx.update(users).set({ balance: sender.balance - amount }).where(eq(users.discordId, sender.discordId));
      await tx.update(users).set({ balance: receiver.balance + amount }).where(eq(users.discordId, receiver.discordId));
    });

    msg.reply(`Sent 💰 ${amount} to ${mentioned.username}`);
  }

  else if (command === 'buy') {
    const itemName = args[0]?.toLowerCase();
    if (!itemName) return msg.reply('Usage: !buy itemname');

    const user = await db.select().from(users).where(eq(users.discordId, discordId)).then(r => r[0]);
    if (!user) return msg.reply('You are not registered.');

    const item = await db.select().from(items).where(eq(items.name, itemName)).then(r => r[0]);
    if (!item) return msg.reply('Item not found.');
    if (user.balance < item.price) return msg.reply('Not enough money.');

    await db.transaction(async (tx) => {
      await tx.update(users).set({ balance: user.balance - item.price }).where(eq(users.discordId, user.discordId));

      const owned = await tx.select().from(userItems)
        .where(eq(userItems.userId, user.id))
        .then(rows => rows.find(r => r.itemId === item.id));

      if (owned) {
        await tx.update(userItems)
          .set({ quantity: owned.quantity + 1 })
          .where(eq(userItems.id, owned.id));
      } else {
        await tx.insert(userItems).values({ userId: user.id, itemId: item.id, quantity: 1 });
      }
    });

    msg.reply(`You bought **${item.name}** for 💰 ${item.price}`);
  }
  else if (command === 'shop') {
    const allItems = await db.select().from(items);

    if (allItems.length === 0) return msg.reply('No items available in the shop.');

    const shopList = allItems.map(i => `🛒 **${i.name}** - 💰 ${i.price}`).join('\n');
    msg.reply(`**Marketplace Items:**\n${shopList}`);
  }

  else if (command === 'inventory') {
    const user = await db.select().from(users).where(eq(users.discordId, discordId)).then(r => r[0]);
    if (!user) return msg.reply('You are not registered.');

    const owned = await db.select({
      itemName: items.name,
      quantity: userItems.quantity
    })
      .from(userItems)
      .where(eq(userItems.userId, user.id))
      .leftJoin(items, eq(userItems.itemId, items.id));

    if (owned.length === 0) return msg.reply('Your inventory is empty.');

    const list = owned.map(i => `🎒 ${i.itemName} x${i.quantity}`).join('\n');
    msg.reply(`**Your Inventory:**\n${list}`);
  }


  // You can add `!sell`, `!inventory`, `!shop` similarly
});


client.login(process.env.DISCORD_TOKEN);
