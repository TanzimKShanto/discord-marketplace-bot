import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';


export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  author: text('author').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suggestions = pgTable('suggestions', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  author: text('author').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})


// users.ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  balance: integer("balance").notNull().default(1000), // Starting money
});

// items.ts
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  price: integer("price").notNull(),
});

// user_items.ts
export const userItems = pgTable("user_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  itemId: integer("item_id").references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
});
