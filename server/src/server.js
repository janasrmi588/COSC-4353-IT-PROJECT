import { createApp } from "./app.js";
import { connectDatabase } from "./db/connect.js";

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    const connection = await connectDatabase();
    console.log(`Connected to MongoDB database "${connection.name}".`);
  } catch (error) {
    console.error(`Could not connect to MongoDB: ${error.message}`);
    process.exit(1);
  }

  createApp().listen(PORT, () => {
    console.log(`QueueSmart API listening on http://localhost:${PORT}`);
  });
}

start();
