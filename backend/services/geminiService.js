let GoogleGenerativeAI = null;
try {
  ({ GoogleGenerativeAI } = require("@google/generative-ai"));
} catch (error) {
  console.warn("Gemini SDK is not installed.");
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const INTENT_MODEL =
  process.env.GEMINI_INTENT_MODEL || DEFAULT_MODEL;
const INSIGHT_MODEL =
  process.env.GEMINI_INSIGHT_MODEL || "gemini-1.5-flash";
const PLACEHOLDER_KEYS = new Set([
  "",
  "your_gemini_api_key_here",
  "replace_with_gemini_api_key",
]);

const rawApiKey = (process.env.GEMINI_API_KEY || "").trim();
const hasUsableApiKey = rawApiKey && !PLACEHOLDER_KEYS.has(rawApiKey);

let genAI = null;
if (GoogleGenerativeAI && hasUsableApiKey) {
  genAI = new GoogleGenerativeAI(rawApiKey);
  console.log(`Gemini AI initialized with model ${DEFAULT_MODEL}`);
} else if (hasUsableApiKey) {
  console.log("GEMINI_API_KEY is configured, but the Gemini SDK is not installed.");
} else {
  console.log("No valid GEMINI_API_KEY configured.");
}

const isGeminiConfigured = () => Boolean(genAI);

const INTENT_LABELS = new Set(["data", "report", "insight", "count", "chat"]);

const normalizeIntentLabel = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[^a-z\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized.includes("count")) return "count";
  if (normalized.includes("report")) return "report";
  if (normalized.includes("insight")) return "insight";
  if (normalized.includes("data")) return "data";
  if (normalized.includes("chat")) return "chat";

  const [firstToken] = normalized.split(/\s+/);
  return INTENT_LABELS.has(firstToken) ? firstToken : null;
};

const buildMinimalFacts = (liveFacts = {}) => ({
  student: liveFacts.student
    ? {
        name: liveFacts.student.name || null,
        rollNumber: liveFacts.student.rollNumber || null,
        department: liveFacts.student.departmentCode || liveFacts.student.department || null,
        cgpa: liveFacts.student.cgpa ?? null,
        averageAttendance: liveFacts.student.averageAttendance ?? null,
        currentBacklogs: liveFacts.student.currentBacklogs ?? null,
      }
    : null,
  department: liveFacts.department
    ? {
        name: liveFacts.department.name || null,
        code: liveFacts.department.code || null,
        totalStudents: liveFacts.department.totalStudents ?? null,
        averageCGPA: liveFacts.department.averageCGPA ?? null,
        averageAttendance: liveFacts.department.averageAttendance ?? null,
        placementPercentage: liveFacts.department.placementPercentage ?? null,
        rank: liveFacts.department.rank ?? null,
      }
    : null,
  overview: liveFacts.overview
    ? {
        activeStudents: liveFacts.overview.activeStudents ?? null,
        totalDepartments: liveFacts.overview.totalDepartments ?? null,
        averageCGPA: liveFacts.overview.averageCGPA ?? null,
        averageAttendance: liveFacts.overview.averageAttendance ?? null,
        totalPlacements: liveFacts.overview.totalPlacements ?? null,
        totalResearchPapers: liveFacts.overview.totalResearchPapers ?? null,
        atRiskStudents: liveFacts.overview.atRiskStudents ?? null,
      }
    : null,
});

const buildChatPrompt = ({ message, liveFacts = {} }) => {
  const minimalFacts = buildMinimalFacts(liveFacts);
  const rolePromptContext =
    liveFacts.accessScope?.rolePromptContext ||
    "You must respect the authenticated user's permitted data scope.";

  return `You are Jorvis, an IQAC assistant.

Instructions:
- Answer in 150 to 200 words.
- Use the relevant facts below only when they help answer the question.
- If a fact is missing, say so clearly.
- Do not invent numbers, students, departments, or reports.
- Do not output JSON or markdown tables.
- Keep the tone professional and direct.
- ${rolePromptContext}

Relevant facts:
${JSON.stringify(minimalFacts)}

User message:
${message}`;
};

const buildGeminiFailure = (liveFacts = {}, errorMessage = "Gemini service is not configured.") => ({
  success: false,
  message: "AI service temporarily unavailable",
  meta: {
    provider: "gemini",
    model: DEFAULT_MODEL,
    error: errorMessage,
    sourceDatabase: liveFacts.sourceDatabase || null,
    usedLiveData: Boolean(liveFacts.student || liveFacts.department || liveFacts.overview),
  },
});

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

    const prompt = `Classify the user query into exactly one intent.

Allowed intents:
- data
- report
- insight
- count
- chat

Rules:
- Return only one lowercase word from the allowed intents.
- Use count for total/how many/number-of queries.
- Use report for report/summary/export/generate-report requests.
- Use insight for analysis/recommendation/why/compare questions.
- Use data for show/list/get/filter/look-up requests.
- Use chat for greetings, thanks, or general conversation.

Query: "${userMessage}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return normalizeIntentLabel(response.text());
  } catch (error) {
    console.error("Gemini intent classification error:", {
      message: error.message,
      status: error.status,
      cause: error.cause?.message,
      model: INTENT_MODEL,
    });

    return null;
  }
};

const buildMinimalInsightContext = (contextData = {}) => {
  const totalStudents =
    Number(contextData.department?.totalStudents) ||
    Number(contextData.overview?.activeStudents) ||
    (contextData.student ? 1 : 0);
  const avgCGPA =
    contextData.department?.averageCGPA ??
    contextData.overview?.averageCGPA ??
    contextData.student?.cgpa ??
    null;
  const totalBacklogs =
    Number(contextData.department?.totalBacklogs) ||
    Number(contextData.backlogOverview?.totalBacklogs) ||
    Number(contextData.student?.currentBacklogs) ||
    0;
  const averageAttendance =
    contextData.department?.averageAttendance ??
    contextData.overview?.averageAttendance ??
    contextData.student?.averageAttendance ??
    null;
  const departmentSummary = contextData.department
    ? {
        name: contextData.department.name || null,
        code: contextData.department.code || null,
        totalStudents: contextData.department.totalStudents ?? null,
        averageCGPA: contextData.department.averageCGPA ?? null,
        totalBacklogs: contextData.department.totalBacklogs ?? null,
        averageAttendance: contextData.department.averageAttendance ?? null,
        placementPercentage: contextData.department.placementPercentage ?? null,
      }
    : null;

  return {
    totalStudents,
    avgCGPA,
    totalBacklogs,
    averageAttendance,
    atRiskStudents: contextData.overview?.atRiskStudents ?? contextData.department?.atRiskStudents ?? null,
    departmentSummary,
  };
};

const hasEnoughInsightData = (minimalContext = {}) =>
  Boolean(
    minimalContext.totalStudents > 0 ||
      minimalContext.avgCGPA !== null ||
      minimalContext.totalBacklogs > 0 ||
      minimalContext.departmentSummary
  );

const buildInsightFailure = ({
  message,
  errorMessage,
  contextData = {},
}) => ({
  success: false,
  type: "insight_fallback",
  reply: message,
  message,
  meta: {
    provider: "gemini",
    model: INSIGHT_MODEL,
    error: errorMessage,
    sourceDatabase: contextData.sourceDatabase || null,
    usedLiveData: Boolean(
      contextData.student ||
        contextData.department ||
        contextData.overview ||
        contextData.backlogOverview
    ),
  },
});

const getGeminiResponse = async ({ message, liveFacts = {} }) => {
  const userMessage = String(message || "").trim();
  if (!userMessage) {
    return buildGeminiFailure(liveFacts, "Message is required");
  }

  if (!genAI) {
    return buildGeminiFailure(liveFacts, "Gemini service is not configured");
  }

  try {
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: {
        maxOutputTokens: 320,
        temperature: 0.4,
      },
    });

    const result = await model.generateContent(
      buildChatPrompt({ message: userMessage, liveFacts })
    );
    const response = await result.response;
    const reply = response.text()?.trim();

    if (!reply) {
      return buildGeminiFailure(liveFacts, "Empty response received from Gemini");
    }

    return {
      success: true,
      reply,
      meta: {
        provider: "gemini",
        model: DEFAULT_MODEL,
        sourceDatabase: liveFacts.sourceDatabase || null,
        usedLiveData: Boolean(liveFacts.student || liveFacts.department || liveFacts.overview),
      },
    };
  } catch (error) {
    console.error("Gemini error:", {
      message: error.message,
      status: error.status,
      cause: error.cause?.message,
      model: DEFAULT_MODEL,
    });

    return buildGeminiFailure(liveFacts, error.message || "Gemini request failed");
  }
};

const generateAIInsight = async (message, contextData = {}) => {
  const userMessage = String(message || "").trim();
  if (!userMessage) {
    return buildInsightFailure({
      message: "Insight question is required",
      errorMessage: "Message is required",
      contextData,
    });
  }

  if (!genAI) {
    return buildInsightFailure({
      message: "AI service not configured",
      errorMessage: "Gemini service is not configured",
      contextData,
    });
  }

  const minimalContext = buildMinimalInsightContext(contextData);
  if (!hasEnoughInsightData(minimalContext)) {
    return buildInsightFailure({
      message: "Not enough data to generate insights",
      errorMessage: "Insufficient live context",
      contextData,
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: INSIGHT_MODEL,
      generationConfig: {
        maxOutputTokens: 240,
        temperature: 0.4,
      },
    });

    const prompt = `You are an academic performance analyst for an IQAC system.

User Question:
"${userMessage}"

Available Data:
${JSON.stringify(minimalContext)}

Provide:
1. Root cause analysis
2. Key insights
3. Actionable recommendations

Keep the response under 150 words.
Do not invent statistics or entities.
Do not output JSON or markdown tables.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reply = response.text()?.trim();

    if (!reply) {
      return buildInsightFailure({
        message: "Insight generation is temporarily unavailable",
        errorMessage: "Empty response received from Gemini",
        contextData,
      });
    }

    return {
      success: true,
      type: "insight",
      reply,
      message: reply,
      summary: minimalContext,
      meta: {
        provider: "gemini",
        model: INSIGHT_MODEL,
        sourceDatabase: contextData.sourceDatabase || null,
        usedLiveData: true,
      },
    };
  } catch (error) {
    console.error("Gemini Insight Error:", error.message);

    return buildInsightFailure({
      message: "Insight generation is temporarily unavailable",
      errorMessage: error.message || "Gemini insight request failed",
      contextData,
    });
  }
};

const generateGeminiInsight = async ({
  userMessage,
  insightType,
  dataSummary,
  fallbackReply,
  fallbackStructuredInsight,
}) => {
  if (!userMessage?.trim()) {
    throw new Error("Message is required");
  }

  if (!genAI) {
    return {
      reply: fallbackReply,
      insight: fallbackStructuredInsight || null,
      meta: {
        provider: "fallback",
        model: null,
        sourceDatabase: null,
        usedLiveData: true,
      },
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: {
        maxOutputTokens: 280,
        temperature: 0.4,
      },
    });

    const prompt = `You are an IQAC analytics insight assistant.

Task:
- Use ONLY the summarized live data provided below.
- Do not invent any metrics or records.
- Keep the answer short, clear, and practical.
- Return STRICT JSON only.
- The JSON shape must be:
  {
    "title": "short heading",
    "reply": "2 to 3 sentence summary",
    "problem": ["point 1", "point 2"],
    "impact": "short impact statement",
    "suggestions": ["suggestion 1", "suggestion 2"]
  }
- The problem and suggestions arrays should have 2 to 4 items each.
- Explain the issue or give suggestions based on the numbers.
- If the question asks for prediction, give a cautious trend-based prediction, not certainty.
- Do not mention MongoDB, prompts, or internal system details.

Insight type: ${insightType}
User question: ${userMessage}

Summarized live data:
${JSON.stringify(dataSummary, null, 2)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text()?.trim();

    if (text) {
      const parsed = JSON.parse(text.replace(/```json|```/gi, "").trim());
      return {
        reply: parsed.reply || fallbackReply,
        insight: {
          title: parsed.title || null,
          problem: Array.isArray(parsed.problem) ? parsed.problem : [],
          impact: parsed.impact || "",
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        },
        meta: {
          provider: "gemini-insight",
          model: DEFAULT_MODEL,
          sourceDatabase: null,
          usedLiveData: true,
        },
      };
    }
  } catch (error) {
    console.error("Gemini insight error:", {
      message: error.message,
      status: error.status,
      cause: error.cause?.message,
      model: DEFAULT_MODEL,
    });
  }

  return {
    reply: fallbackReply,
    insight: fallbackStructuredInsight || null,
    meta: {
      provider: "fallback",
      model: null,
      sourceDatabase: null,
      usedLiveData: true,
    },
  };
};

module.exports = {
  generateAIInsight,
  getGeminiResponse,
  getGeminiIntent,
  generateGeminiInsight,
  buildMinimalFacts,
  buildMinimalInsightContext,
  isGeminiConfigured,
};
