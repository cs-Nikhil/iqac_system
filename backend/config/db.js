const mongoose = require("mongoose");

const resolveMongoUri = () => {
  const rawUri = process.env.MONGO_URI || process.env.BMONGO_URI || process.env.bmongoUri;
  const dbName = process.env.MONGO_DB_NAME;

  if (!rawUri || !dbName) {
    return rawUri;
  }

  try {
    const parsedUri = new URL(rawUri);
    const hasDatabaseName = parsedUri.pathname && parsedUri.pathname !== "/";

    if (!hasDatabaseName) {
      parsedUri.pathname = `/${dbName}`;
    }

    return parsedUri.toString();
  } catch (_error) {
    return rawUri;
  }
};

const connectDB = async () => {
  const mongoUri = resolveMongoUri();

  if (!mongoUri) {
    console.error(
      "MONGO_URI is not set. Create backend/.env from backend/.env.example before starting the server."
    );
    process.exit(1);
  }

  try {
    const parsedUri = new URL(mongoUri);
    if (parsedUri.username && !parsedUri.password) {
      console.error(
        "MongoDB connection error: Atlas URI has a username but no password. Use mongodb+srv://<username>:<password>@<cluster>/<database> in backend/.env."
      );
      process.exit(1);
    }
  } catch (_error) {
    // Let mongoose report malformed URI details below.
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
