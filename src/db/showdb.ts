import { messages } from "./schema.js";
import { db } from "./index.js";

const allMessages = await db.select().from(messages);

console.log(allMessages);
