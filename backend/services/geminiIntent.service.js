let GoogleGenerativeAI = null;
try {
  ({ GoogleGenerativeAI } = require("@google/generative-ai"));
} catch (error) {
  console.warn("Gemini SDK is not installed.");
}

const INTENT_MODEL =
  process.env.GEMINI_INTENT_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";
const PLACEHOLDER_KEYS = new Set([
  "",
  "your_gemini_api_key_here",
  "replace_with_gemini_api_key",
]);

const rawApiKey = (process.env.GEMINI_API_KEY || "").trim();
const hasUsableApiKey = rawApiKey && !PLACEHOLDER_KEYS.has(rawApiKey);

const genAI =
  GoogleGenerativeAI && hasUsableApiKey
    ? new GoogleGenerativeAI(rawApiKey)
    : null;

const ALLOWED_INTENTS = new Set(["data", "report", "insight", "count"]);

const normalizeIntent = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const [firstToken] = normalized.split(/\s+/);
  return ALLOWED_INTENTS.has(firstToken) ? firstToken : null;
};

const getGeminiIntent = async (message = "") => {
  const userMessage = String(message || "").trim();
  if (!userMessage || !genAI) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: INTENT_MODEL,
      generationConfig: {
        maxOutputTokens: 8,
        temperature: 0,
      },
    });

    const prompt = `Classify the user query into ONE of these intents:
[data, report, insight, count]

Query: "${userMessage}"

Return ONLY one word.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return normalizeIntent(response.text());
  } catch (error) {
    console.error("Gemini Intent Error:", error.message);
    return null;
  }
};

module.exports = {
  getGeminiIntent,
};
