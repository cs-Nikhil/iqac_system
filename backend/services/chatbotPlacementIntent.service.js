const DRIVE_PATTERN =
  /\b(placement\s+drive|placement\s+drives|drive|drives|deadline|upcoming drive|open drive|open drives|placement opportunity|placement opportunities|eligible drives?)\b/i;
const ELIGIBILITY_PATTERN =
  /\b(eligible|eligibility|am i eligible|do i qualify|qualification)\b/i;
const REQUIREMENT_PATTERN =
  /\b(requirement|requirements|criteria|criterion)\b/i;
const READINESS_PATTERN =
  /\b(placement readiness|readiness summary|placement summary|placement opportunities|placement status)\b/i;
const APPLICATION_PATTERN =
  /\b(my|show|list|track|status|history|count)\b.*\bapplications?\b|\bapplications?\b.*\b(status|history|selected|shortlisted|rejected|withdrawn)\b/i;
const APPLY_TO_DRIVE_PATTERN = /\bapply to\b|\bcontinue application\b/i;
const GENERIC_APPLY_PATTERN =
  /\b(?:i\s+want\s+to\s+apply|want\s+to\s+apply|apply)\b.*\bplacement\b/i;
const PLACEMENT_RECORD_PATTERN =
  /\bplacement\b|\bplacements\b|\bplaced\b|\bpackage\b|\bpackages\b|\bcompany\b|\bcompanies\b|\brecruiter\b|\brecruiters\b|\boffer\b|\boffers\b/i;
const CONVERSATIONAL_COMPANY_PATTERN =
  /^(?:am\s+i\s+eligible\s+for|do\s+i\s+qualify\s+for|i\s+want\s+to\s+apply\s+for|want\s+to\s+apply\s+for|apply\s+for|apply\s+to|eligible\s+for|requirement(?:s)?\s+for|criteria\s+for|qualification\s+for|show|list|get|open|my|our)\b/i;
const INVALID_COMPANY_PATTERN =
  /^(student|students|placement|placements|company|companies|recruit|recruitment|recruiter|recruiters|detail|details|drive|drives|eligibility|eligible|qualification|requirement|requirements|criteria|criterion|application|applications|status)$/i;

const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizePlacementDomain = (value = "") => {
  const normalized = normalizeLower(value);
  if (["placement_application", "application", "applications"].includes(normalized)) {
    return "placement_application";
  }
  if (["placement_drive", "drive", "drives"].includes(normalized)) {
    return "placement_drive";
  }
  return "placement_record";
};

const normalizePlacementCompanyCandidate = (value = "") => {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();

  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (
    INVALID_COMPANY_PATTERN.test(lowered) ||
    CONVERSATIONAL_COMPANY_PATTERN.test(lowered)
  ) {
    return null;
  }

  if (
    /\b(?:am|eligible|qualify|apply|want|show|list|get|open|placement|drive|company|requirements?|criteria)\b/i.test(
      normalized
    ) &&
    !/[&.]/.test(normalized) &&
    !/\b(?:technologies|technology|systems|solutions|services|labs|lab|corp|corporation|consulting|global|software|infosys|tcs|wipro|hcl|accenture|amazon|google|microsoft|ibm)\b/i.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
};

const getPrimitiveFilterValue = (filters = {}, keys = []) => {
  for (const key of keys) {
    const value = filters?.[key];
    if (value == null || value === "") {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (isPlainObject(value)) {
      if (value.$eq !== undefined) return value.$eq;
      if (value.eq !== undefined) return value.eq;
    }
  }

  return null;
};

const extractPlacementCompany = (message = "", parsedQuery = null) => {
  const explicitCompany = getPrimitiveFilterValue(parsedQuery?.filters || {}, ["company"]);
  if (explicitCompany) {
    return normalizePlacementCompanyCandidate(explicitCompany);
  }

  const patterns = [
    /\b(?:company|recruiter)\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)(?=\s+(?:drive|drives|placements?|applications?|report|status|deadline|for|in|with|of|from|this|that|top|highest|lowest|best|worst|summary|analysis)\b|$)/i,
    /\b([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)\s+placement\s+(?:requirement|requirements|criteria|criterion)\b/i,
    /\b(?:recruited|hired|selected|offered|placed)\s+by\s+([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)(?=\s+(?:for|in|from|with|year|students?|details?|list|report|summary|analysis|applications?|drives?)\b|$)/i,
    /\b(?:edit|update|modify|open|apply to|apply for|eligible for)\s+([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)(?=\s+drive\b|$)/i,
    /\b([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)\s+drive\b/i,
    /\b([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)\s+(?:recruit(?:ed|ment|ing)?|hiring|hired|offers?)\b/i,
    /\b([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)\s+placements?\b/i,
    /\b([A-Za-z][A-Za-z0-9&.,\s-]{1,60}?)\s+(?:recruit(?:ed|ing)?\s+students?|student\s+details?|student\s+detail)\b/i,
  ];

  for (const pattern of patterns) {
    const candidate = normalizePlacementCompanyCandidate(message.match(pattern)?.[1] || "");
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const isPlacementEligibilityQuery = (message = "") =>
  ELIGIBILITY_PATTERN.test(normalizeText(message));

const isPlacementRequirementQuery = (message = "") => {
  const normalized = normalizeLower(message);
  if (!normalized) {
    return false;
  }

  return REQUIREMENT_PATTERN.test(normalized) && /\bplacement\b|\bdrive\b|\bcompany\b|\brecruiter\b/i.test(normalized);
};

const isPlacementReadinessQuery = (message = "") =>
  READINESS_PATTERN.test(normalizeText(message));

const isGenericPlacementApplyQuery = (message = "", parsedQuery = null) =>
  GENERIC_APPLY_PATTERN.test(normalizeLower(message)) &&
  !extractPlacementCompany(message, parsedQuery);

const detectPlacementDomain = (message = "", parsedQuery = null) => {
  const explicitDomain =
    parsedQuery?.placementDomain || parsedQuery?.domain || parsedQuery?.subEntity || null;
  if (explicitDomain) {
    return normalizePlacementDomain(explicitDomain);
  }

  const normalized = normalizeLower(message);
  if (!normalized) {
    return null;
  }

  if (APPLICATION_PATTERN.test(normalized)) {
    return "placement_application";
  }

  if (APPLY_TO_DRIVE_PATTERN.test(normalized) || isGenericPlacementApplyQuery(normalized, parsedQuery)) {
    return "placement_drive";
  }

  if (
    DRIVE_PATTERN.test(normalized) ||
    isPlacementEligibilityQuery(normalized) ||
    isPlacementRequirementQuery(normalized) ||
    isPlacementReadinessQuery(normalized)
  ) {
    return "placement_drive";
  }

  if (PLACEMENT_RECORD_PATTERN.test(normalized)) {
    return "placement_record";
  }

  return null;
};

module.exports = {
  detectPlacementDomain,
  extractPlacementCompany,
  isGenericPlacementApplyQuery,
  isPlacementEligibilityQuery,
  isPlacementReadinessQuery,
  isPlacementRequirementQuery,
  normalizePlacementCompanyCandidate,
  normalizePlacementDomain,
};
