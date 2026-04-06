const { generateGeminiInsight } = require("./geminiService");

const CONTEXT_TTL_MS = 10 * 60 * 1000;
const MAX_CONTEXT_ENTRIES = 100;

const contextStore = new Map();

const LABEL_KEYS = [
  "name",
  "title",
  "department",
  "subject",
  "subjectCode",
  "code",
  "label",
  "rollNumber",
  "departmentCode",
  "company",
  "type",
];

const NUMERIC_EXCLUDE_KEYS = new Set(["rank"]);

const normalizeText = (value = "") => String(value).trim().toLowerCase();

const humanize = (value = "record") =>
  String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (m) => m.toUpperCase());

const roundTo = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(digits));
};

const isPlainRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);



const cleanupContextStore = () => {
  const expiry = Date.now() - CONTEXT_TTL_MS;

  for (const [key, value] of contextStore.entries()) {
    if ((value?.updatedAt || 0) < expiry) {
      contextStore.delete(key);
    }
  }

  // Hard cap
  if (contextStore.size > MAX_CONTEXT_ENTRIES) {
    const keys = [...contextStore.keys()];
    keys.slice(0, contextStore.size - MAX_CONTEXT_ENTRIES).forEach((k) =>
      contextStore.delete(k)
    );
  }
};

const getContextEntry = (key) => {
  cleanupContextStore();
  return key ? contextStore.get(key) || null : null;
};

const setContextEntry = (key, value = {}) => {
  if (!key) return null;

  cleanupContextStore();

  const next = {
    ...(contextStore.get(key) || {}),
    ...value,
    updatedAt: Date.now(),
  };

  contextStore.set(key, next);
  return next;
};

const clearContextEntry = (key) => {
  if (key) contextStore.delete(key);
};


const isContextQuery = (message = "") => {
  const normalized = normalizeText(message);

  return /\b(this|above|previous|earlier|last result|this data|those results)\b/.test(
    normalized
  );
};



const normalizeDataset = (value) => {
  if (Array.isArray(value)) {
    return value.filter(isPlainRecord);
  }

  if (!value || typeof value !== "object") return [];

  return (
    normalizeDataset(value.rows) ||
    normalizeDataset(value.data) ||
    normalizeDataset(value.sample) ||
    normalizeDataset(value.contextData) ||
    normalizeDataset(value.extraData?.rows) ||
    []
  );
};


const extractUsableData = (payload = {}) => {
  const candidates = [
    payload.rows,
    payload.data,
    payload.extraData?.rows,
    payload.extraData,
    payload.contextData,
    payload.chart?.data,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c;
    }
  }

  return [];
};



const safeAverage = (values = []) => {
  const valid = values.filter((v) => Number.isFinite(Number(v)));
  return valid.length
    ? valid.reduce((a, b) => a + Number(b), 0) / valid.length
    : 0;
};

const calculateAverages = (data = [], fields = []) => {
  const result = {};
  fields.forEach((field) => {
    result[field] = roundTo(safeAverage(data.map((r) => r?.[field])));
  });
  return result;
};

const getNumericFields = (data = []) => {
  const map = new Map();

  data.slice(0, 20).forEach((record) => {
    Object.entries(record || {}).forEach(([k, v]) => {
      if (NUMERIC_EXCLUDE_KEYS.has(k)) return;

      if (Number.isFinite(Number(v))) {
        map.set(k, (map.get(k) || 0) + 1);
      }
    });
  });

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
};

const getLabelField = (data = []) => {
  const sample = data.find(isPlainRecord) || {};

  return (
    LABEL_KEYS.find((key) =>
      data.some((r) => r?.[key] !== undefined && r?.[key] !== null)
    ) ||
    Object.keys(sample).find((k) => typeof sample[k] === "string") ||
    "label"
  );
};



const generateChartData = (data = []) => {
  const normalized = normalizeDataset(data);
  if (!normalized.length) return null;

  const numericKey = getNumericFields(normalized)[0];
  if (!numericKey) return null;

  const labelKey = getLabelField(normalized);

  return {
    type: "bar",
    xKey: "label",
    yKey: "value",
    metric: humanize(numericKey),
    data: normalized.slice(0, 10).map((r, i) => ({
      label:
        r?.[labelKey] ||
        r?.name ||
        r?.department ||
        r?.subject ||
        `Item ${i + 1}`,
      value: roundTo(r?.[numericKey]),
    })),
  };
};


const generateDynamicReport = (entity = "generic", data = [], options = {}) => {
  const normalized = normalizeDataset(data);
  if (!normalized.length) return null;

  const numericFields = getNumericFields(normalized);
  const averages = calculateAverages(normalized, numericFields);
  const sample = normalized.slice(0, 10);
  const chart = generateChartData(normalized);

  return {
    title: `# ${humanize(entity)} Report`,
    entityType: entity,
    reportType: options.queryType || "dynamic",
    summary: {
      totalRecords: normalized.length,
      averages,
    },
    tables: [
      {
        title: `${humanize(entity)} Sample`,
        rows: sample,
      },
    ],
    chart,
    data: {
      rows: sample,
      totalRecords: normalized.length,
      averages,
    },
  };
};


const inferEntityTypeFromData = (data = [], fallback = null) => {
  const sample = data.find(isPlainRecord) || {};

  if ("rollNumber" in sample) return "student";
  if ("designation" in sample) return "faculty";
  if ("subjectCode" in sample) return "subject";
  if ("company" in sample) return "placement";

  return fallback || "generic";
};



const buildDynamicInsight = async ({
  message,
  entity = "generic",
  data = [],
  queryType = "analysis",
}) => {
  const report = generateDynamicReport(entity, data, { queryType });
  if (!report) return null;

  const ai = await generateGeminiInsight({
    userMessage: message,
    dataSummary: report.summary,
  });

  return {
    success: true,
    type: "insight",
    entity,
    reply: ai.reply,
    insights: ai.insight,
    chart: report.chart,
    extraData: report.data,
  };
};




module.exports = {
  calculateAverages,
  clearContextEntry,
  contextStore,
  generateChartData,
  generateDynamicReport,
  buildDynamicInsight,
  extractUsableData,
  getContextEntry,
  inferEntityTypeFromData,
  isContextQuery,
  normalizeDataset,
  safeAverage,
  setContextEntry,
};