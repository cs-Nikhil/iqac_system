const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const connectDB = require("./config/db");

// Load environment variables
dotenv.config();

// Connect MongoDB
connectDB();

const app = express();
const normalizeOrigin = (origin = "") => String(origin).trim().replace(/\/+$/, "");
const defaultAllowedOrigins = [
  "https://iqac-system-mxyu.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const allowedOriginList = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : defaultAllowedOrigins;
if (process.env.FRONTEND_URL) {
  allowedOriginList.push(process.env.FRONTEND_URL);
}
const allowedOrigins = new Set(
  allowedOriginList
    .map(normalizeOrigin)
    .filter(Boolean)
);
const allowAllOrigins = allowedOrigins.has("*");

// ==============================
// Middleware
// ==============================

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, health checks)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowAllOrigins || allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// ==============================
// Routes
// ==============================

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/staff", require("./routes/staff.routes"));
app.use("/api/students", require("./routes/student.routes"));
app.use("/api/student", require("./routes/studentPortal.routes"));
app.use("/api/faculty", require("./routes/faculty.routes"));
app.use("/api/departments", require("./routes/department.routes"));

app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api/analytics", require("./routes/enhanced-analytics.routes"));

app.use("/api/placements", require("./routes/placement.routes"));
app.use("/api/research", require("./routes/research.routes"));

app.use("/api/reports", require("./routes/report.routes"));
app.use("/api/achievements", require("./routes/achievement.routes"));
app.use("/api/events", require("./routes/event.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));

app.use("/api/nba", require("./routes/nba.routes"));
app.use("/api/naac", require("./routes/naac.routes"));

app.use("/api/documents", require("./routes/document.routes"));
app.use("/api/chatbot", require("./routes/chatbot.routes"));


// ==============================
// Health Check
// ==============================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "IQAC System API is running",
    timestamp: new Date()
  });
});

// ==============================
// Frontend (Production)
// ==============================

const serveFrontend =
  String(process.env.SERVE_FRONTEND || "").toLowerCase() === "true" ||
  process.env.NODE_ENV === "production";
const frontendDistPath = path.resolve(__dirname, "..", "frontend", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

if (serveFrontend && fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));

  // SPA fallback: anything that's not /api or /uploads should resolve to index.html
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(frontendIndexPath);
  });
}


// ==============================
// 404 Handler
// ==============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});


// ==============================
// Global Error Handler
// ==============================

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});


// ==============================
// Start Server
// ==============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("=================================");
  console.log("IQAC System Server running");
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("=================================");
});
