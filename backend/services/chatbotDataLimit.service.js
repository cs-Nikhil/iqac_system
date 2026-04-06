const DEFAULT_PREVIEW_LIMIT = 100;
const MAX_LIMIT = 500;

const FULL_DATA_PATTERNS = [
  /\ball\b/i,
  /\bcomplete\b/i,
  /\bfull\b/i,
  /\bentire\b/i,
  /\bshow\s+everything\b/i,
];

const DISPLAY_SUFFIX_PATTERNS = [
  /\s*All matching records are included in the table\.?$/i,
  /\s*Showing the first \d+ records\.?$/i,
  /\s*Showing \d+ matching records\.?$/i,
  /\s*Showing all \d+ records\.?$/i,
  /\s*Showing \d+ of \d+ records\.?$/i,
];

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFullDataRequest = (message = "") =>
  FULL_DATA_PATTERNS.some((pattern) => pattern.test(String(message)));

const toPositiveInteger = (value, fallback = null) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const hasPaginationRequest = (query = {}) =>
  query?.page !== undefined || query?.limit !== undefined;

const getAllRows = (response = {}) => {
  if (Array.isArray(response.contextData)) {
    return response.contextData;
  }

  if (Array.isArray(response.rows)) {
    return response.rows;
  }

  if (Array.isArray(response.extraData?.contextData)) {
    return response.extraData.contextData;
  }

  if (Array.isArray(response.extraData?.rows)) {
    return response.extraData.rows;
  }

  if (Array.isArray(response.extraData)) {
    return response.extraData;
  }

  return [];
};

const stripDisplaySuffix = (text = "") =>
  DISPLAY_SUFFIX_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "").trim(),
    String(text || "")
  );

const withDisplayMessage = (text = "", displayMessage = "") => {
  const cleanText = stripDisplaySuffix(text);
  if (!displayMessage) {
    return cleanText;
  }

  return cleanText ? `${cleanText} ${displayMessage}.` : `${displayMessage}.`;
};

const buildDisplayMessage = ({
  fullRequested = false,
  totalRecords = 0,
  returnedRecords = 0,
  paginationEnabled = false,
  page = 1,
  limit = DEFAULT_PREVIEW_LIMIT,
} = {}) => {
  if (paginationEnabled) {
    const start = totalRecords ? (page - 1) * limit + 1 : 0;
    const end = totalRecords ? Math.min(start + returnedRecords - 1, totalRecords) : 0;

    return totalRecords
      ? `Showing ${returnedRecords} of ${totalRecords} records (page ${page}, records ${start}-${end})`
      : "Showing 0 of 0 records";
  }

  if (fullRequested && returnedRecords === totalRecords) {
    return `Showing all ${totalRecords} records`;
  }

  return `Showing ${returnedRecords} of ${totalRecords} records`;
};

const applyDataLimitPolicy = ({
  message = "",
  response = {},
  requestQuery = {},
} = {}) => {
  if (!response || typeof response !== "object") {
    return response;
  }

  const fullRows = getAllRows(response);
  if (!fullRows.length && !Array.isArray(response.rows)) {
    return response;
  }

  const totalRecords = Number.isFinite(Number(response.totalRecords))
    ? Number(response.totalRecords)
    : Number.isFinite(Number(response.count))
      ? Number(response.count)
      : fullRows.length;
  const responseMaxLimit = Math.min(
    toPositiveInteger(response.maxLimit, MAX_LIMIT) || MAX_LIMIT,
    MAX_LIMIT
  );
  const fullRequested = isFullDataRequest(message);
  const paginationEnabled = hasPaginationRequest(requestQuery);
  const page = Math.max(toPositiveInteger(requestQuery.page, 1), 1);
  const requestedLimit = toPositiveInteger(requestQuery.limit, null);
  let effectiveLimit;

  if (requestedLimit !== null) {
    effectiveLimit = requestedLimit;
  } else if (paginationEnabled) {
    effectiveLimit = DEFAULT_PREVIEW_LIMIT;
  } else if (fullRequested) {
    effectiveLimit = totalRecords || responseMaxLimit;
  } else {
    effectiveLimit = DEFAULT_PREVIEW_LIMIT;
  }
  // ✅ Safety cap
  effectiveLimit = Math.min(effectiveLimit, responseMaxLimit);

  let responseRows = [];
  if (paginationEnabled) {
    const offset = (page - 1) * effectiveLimit;
    responseRows = fullRows.slice(offset, offset + effectiveLimit);
  } else if (fullRequested) {
    responseRows = fullRows.slice(0, responseMaxLimit);
  } else {
    responseRows = fullRows.slice(0, effectiveLimit);
  }

  const returnedRecords = responseRows.length;
  const isFull = fullRequested && !paginationEnabled && returnedRecords === totalRecords;
  const displayMessage = buildDisplayMessage({
    fullRequested,
    totalRecords,
    returnedRecords,
    paginationEnabled,
    page,
    limit: effectiveLimit,
  });
  const baseReply = response.reply || response.message || "";
  const updatedReply = withDisplayMessage(baseReply, displayMessage);
  const summary =
    isPlainObject(response.summary)
      ? {
          ...response.summary,
          totalRecords,
          returnedRecords,
          isFull,
          displayMessage,
        }
      : {
          totalRecords,
          returnedRecords,
          isFull,
          displayMessage,
        };

  let extraData = response.extraData;
  if (Array.isArray(extraData)) {
    extraData = responseRows;
  } else if (isPlainObject(extraData) && Array.isArray(extraData.rows)) {
    extraData = {
      ...extraData,
      rows: responseRows,
      contextData: Array.isArray(extraData.contextData)
        ? extraData.contextData
        : fullRows,
    };
  }

  return {
    ...response,
    reply: updatedReply,
    ...(response.message ? { message: updatedReply } : {}),
    rows: responseRows,
    count: totalRecords,
    totalRecords,
    returnedRecords,
    isFull,
    fullRequest: fullRequested,
    displayMessage,
    previewLimit: DEFAULT_PREVIEW_LIMIT,
    maxLimit: responseMaxLimit,
    contextData: fullRows,
    extraData,
    summary,
    ...(paginationEnabled
      ? {
          pagination: {
            page,
            limit: effectiveLimit,
            totalRecords,
            totalPages: Math.max(Math.ceil(totalRecords / effectiveLimit), 1),
          },
        }
      : {}),
  };
};

module.exports = {
  DEFAULT_PREVIEW_LIMIT,
  MAX_LIMIT,
  applyDataLimitPolicy,
  isFullDataRequest,
};
