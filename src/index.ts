import 'dotenv/config';

import { Client, GatewayIntentBits, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { db } from './db/index.js';
import { users, items, userItems } from './db/schema.js';
import { eq, sql } from 'drizzle-orm';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
})
type UserRow = {
  id: number;
  balance: number;
  discord_id: string;
}
type ItemRow = {
  id: number;
  name: string;
  price: number;
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.content.startsWith('!')) return;

  const args = msg.content.slice(1).trim().split(' ');
  const command = args.shift()?.toLowerCase();

  const discordId = msg.author.id;

  switch (command) {
    case "register": {
      const existing = await db.select().from(users).where(eq(users.discordId, discordId));
      if (existing.length) return msg.reply("You are already registered!");

      await db.insert(users).values({ discordId, balance: 1000 });
      msg.reply("Registered with 1000 coins!");
      break;
    }

    case "balance": {
      const user = await db.select().from(users).where(eq(users.discordId, discordId)).then(r => r[0]);
      if (!user) return msg.reply("You are not registered.");

      msg.reply(`Your balance is 💰 ${user.balance}`);
      break;
    }

    case "addmoney": {
      if (!msg.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return msg.reply("Only admins can do this.");

      const mentioned = msg.mentions.users.first();
      const amount = parseInt(args[1] ?? "0");

      if (!mentioned || isNaN(amount)) return msg.reply("Usage: !addmoney @user amount");

      await db.transaction(async (tx) => {
        const user = await tx.select()
          .from(users)
          .where(eq(users.discordId, mentioned.id))
          .for('update') // <-- Row-level locking 
          .then(r => r[0]);

        if (!user) {
          return msg.reply('User not registered.');
        }

        const newBalance = user.balance + amount;

        await tx.update(users)
          .set({ balance: newBalance })
          .where(eq(users.discordId, mentioned.id));

        await msg.reply(`Added 💰 ${amount} to ${mentioned.username}`);
      });
      break;
    }

    case "removemoney": {
      if (!msg.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return msg.reply("Only admins can do this.");

      const mentioned = msg.mentions.users.first();
      const amount = parseInt(args[1] ?? "0");

      if (!mentioned || isNaN(amount) || amount <= 0) return msg.reply("Usage: !removemoney @user amount");

      await db.transaction(async (tx) => {
        // Lock the user row for update
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.discordId, mentioned.id))
          .for('update') // This is the row-level lock
          .then(r => r[0]);

        if (!user) {
          return msg.reply("User not registered.");
        }

        if (user.balance < amount) {
          return msg.reply(`${mentioned.username} doesn't have enough money. Current balance: 💰 ${user.balance}`);
        }

        const newBalance = user.balance - amount;

        await tx
          .update(users)
          .set({ balance: newBalance })
          .where(eq(users.discordId, mentioned.id));

        msg.reply(`Removed 💰 ${amount} from ${mentioned.username}`);
      });
      break;
    }

    case "additem": {
      if (!msg.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return msg.reply("Only admins can add items.");

      const [name, priceStr] = args;
      const price = parseInt(priceStr ?? "0");

      if (!name || isNaN(price)) return msg.reply("Usage: !additem <name> <price>");

      const existing = await db.select().from(items).where(eq(items.name, name.toLowerCase()));
      if (existing.length > 0) return msg.reply("Item already exists.");

      await db.insert(items).values({ name: name.toLowerCase(), price });
      msg.reply(`✅ Added item **${name}** with price 💰 ${price}`);
      break;
    }

    case "send": {
      const mentioned = msg.mentions.users.first();
      const amount = parseInt(args[1] ?? "0");

      if (!mentioned || isNaN(amount)) return msg.reply("Usage: !send @user amount");

      await db.transaction(async (tx) => {
        // Lock sender and receiver rows
        const senderResult = await tx.execute(
          sql`SELECT * FROM users WHERE discord_id = ${discordId} FOR UPDATE`
        );
        const receiverResult = await tx.execute(
          sql`SELECT * FROM users WHERE discord_id = ${mentioned.id} FOR UPDATE`
        );

        const sender = senderResult.rows[0] as UserRow;
        const receiver = receiverResult.rows[0] as UserRow;

        if (!sender || !receiver) {
          return msg.reply('Both users must be registered.');
        }

        if (sender.balance < amount) {
          return msg.reply('Insufficient balance.');
        }

        // Now safely update balances
        await tx.execute(
          sql`UPDATE users SET balance = ${sender.balance - amount} WHERE discord_id = ${sender.discord_id}`
        );

        await tx.execute(
          sql`UPDATE users SET balance = ${receiver.balance + amount} WHERE discord_id = ${receiver.discord_id}`
        );

        msg.reply(`Sent 💰 ${amount} to ${mentioned.username}`);
      });
      break;
    }
    // TODO: rewrite the buy with sql
    case "buy": {
      const itemName = args[0]?.toLowerCase();
      if (!itemName) return msg.reply("Usage: !buy itemname");

      try {
        await db.transaction(async (tx) => {
          // Lock the user row FOR UPDATE
          const senderResult = await tx.execute(sql`
        SELECT * FROM users WHERE discord_id = ${discordId} FOR UPDATE
      `);
          const user = senderResult.rows[0] as UserRow;
          if (!user) throw new Error("You are not registered.");

          // Get the item
          const itemResult = await tx.execute(sql`
        SELECT * FROM items WHERE name = ${itemName}
      `);
          const item = itemResult.rows[0] as ItemRow;
          if (!item) throw new Error("Item not found.");

          if (user.balance < item.price) throw new Error("Not enough money.");

          // Deduct balance
          await tx.execute(sql`
        UPDATE users SET balance = balance - ${item.price} WHERE discord_id = ${discordId}
      `);

          // Check ownership and update or insert
          const ownedResult = await tx.execute(sql`
        SELECT * FROM user_items
        WHERE user_id = ${user.id} AND item_id = ${item.id} FOR UPDATE
      `);
          const owned = ownedResult.rows[0];

          if (owned) {
            await tx.execute(sql`
          UPDATE user_items
          SET quantity = quantity + 1
          WHERE id = ${owned.id}
        `);
          } else {
            await tx.execute(sql`
          INSERT INTO user_items (user_id, item_id, quantity)
          VALUES (${user.id}, ${item.id}, 1)
        `);
          }

          msg.reply(`You bought **${item.name}** for 💰 ${item.price}`);
        });
      } catch (err) {
        console.error("Transaction failed:", err);
        msg.reply((err as Error).message || "Something went wrong while buying.");
      }
      break;
    }
    case "shop": {
      const allItems = await db.select().from(items);
      if (allItems.length === 0) return msg.reply("No items available in the shop.");

      const shopList = allItems.map(i => `🛒 **${i.name}** - 💰 ${i.price}`).join("\n");
      msg.reply(`**Marketplace Items:**\n${shopList}`);
      break;
    }

    case "inventory": {
      const user = await db.select().from(users).where(eq(users.discordId, discordId)).then(r => r[0]);
      if (!user) return msg.reply("You are not registered.");

      const owned = await db.select({
        itemName: items.name,
        quantity: userItems.quantity
      })
        .from(userItems)
        .where(eq(userItems.userId, user.id))
        .leftJoin(items, eq(userItems.itemId, items.id));

      if (owned.length === 0) return msg.reply("Your inventory is empty.");

      const list = owned.map(i => `🎒 ${i.itemName} x${i.quantity}`).join("\n");
      msg.reply(`**Your Inventory:**\n${list}`);
      break;
    }

    default:
      msg.reply("Unknown command.");
  }
});


client.login(process.env.DISCORD_TOKEN);
