const {
  extractFilters,
  parseAdvancedFilters,
} = require("./chatbotFilter.service");
const {
  resolveYearFilterContext,
} = require("./chatbotYearFilter.service");
const {
  detectPlacementDomain,
  extractPlacementCompany,
} = require("./chatbotPlacementIntent.service");

const PLAN_MODE_VALUES = new Set([
  "query_parameters",
  "query-parameters",
  "query_params",
  "query-params",
  "parameter_plan",
  "parameter-plan",
  "query_understanding",
  "query-understanding",
  "universal_query_understanding",
  "universal-query-understanding",
  "universal_query_engine",
  "universal-query-engine",
]);

const QUERY_PARAMETER_REQUEST_PATTERN =
  /\b(query parameters|extract query parameters|parameter extractor|query understanding|universal query understanding|filters sorting and limits|sorting and limits)\b/i;
const REPORT_REQUEST_PATTERN =
  /\b(?:generate|create|show|build|return|give|prepare)?\s*(?:a\s+|an\s+|the\s+)?report\b/i;
const CONDITION_SIGNAL_PATTERN =
  /\b(who|with|where|whose|that|having|in|of|belongs to|published in|teach(?:es|ing)?|taught|specialized in|by|in department|from department|for department|field|domain|subject|course|journal|company|designation|category|level)\b/i;
const SHORT_CODE_PATTERN = /^[A-Za-z]{1,6}$/;
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/;
const PLACEMENT_RECRUITMENT_PATTERN =
  /\b(recruit|recruited|recruitment|hire|hired|hiring|offer|offered|selected|selection|recruiter|recruiters)\b/i;
const FRIENDLY_OPERATOR_MAP = {
  $lt: "lt",
  $lte: "lte",
  $gt: "gt",
  $gte: "gte",
  $eq: "eq",
};
const DEPARTMENT_ALIASES = {
  cse: "CSE",
  it: "IT",
  ece: "ECE",
  mech: "MECH",
  mechanical: "MECH",
  civil: "CIVIL",
  "computer science": "CSE",
  "computer science and engineering": "CSE",
  "information technology": "IT",
  "electronics and communication": "ECE",
  "electronics and communication engineering": "ECE",
  "mechanical engineering": "MECH",
  "civil engineering": "CIVIL",
};
const UPPERCASE_VALUE_ALIASES = new Set([
  "ai",
  "ml",
  "nlp",
  "cv",
  "iot",
  "cse",
  "it",
  "ece",
  "mech",
  "civil",
  "sci",
  "scopus",
  "wos",
  "ugc",
]);

const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toNumber = (value) => {
  const numericValue = Number(String(value || "").replace(/%/g, "").trim());
  return Number.isFinite(numericValue) ? numericValue : null;
};

const toSnakeCase = (value = "") =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[.\s-]+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const normalizeValueCase = (value = "") => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (UPPERCASE_VALUE_ALIASES.has(lowered)) {
    return normalized.toUpperCase();
  }

  return SHORT_CODE_PATTERN.test(normalized) && normalized === normalized.toUpperCase()
    ? normalized
    : normalized;
};

const stripPlanningInstruction = (message = "") => {
  const raw = normalizeText(message);
  const stripped = raw
    .replace(
      /\b(?:please\s+)?(?:extract|return|give|show|build|create|process|convert)\b[^:]{0,120}\b(?:query parameters|parameter extractor|filters sorting and limits|sorting and limits|query understanding|universal query understanding)\b[:\s-]*/i,
      ""
    )
    .replace(
      /\b(?:query parameters|parameter extractor|filters sorting and limits|sorting and limits|query understanding|universal query understanding)\b[:\s-]*/gi,
      ""
    )
    .replace(/^for\s+/i, "")
    .trim();

  return stripped || raw;
};

const stripReportInstruction = (message = "") => {
  const raw = normalizeText(message);
  const stripped = raw
    .replace(
      /\b(?:generate|create|show|build|return|give|prepare)\s+(?:a\s+|an\s+|the\s+)?report(?:\s+of|\s+for)?\b/gi,
      ""
    )
    .replace(/\breport(?:\s+of|\s+for)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return stripped || raw;
};

const cleanCapturedValue = (value = "") => {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();

  return normalized || null;
};

const captureValue = (message = "", patterns = []) => {
  for (const pattern of patterns) {
    const value = cleanCapturedValue(message.match(pattern)?.[1] || "");
    if (value) {
      return value;
    }
  }

  return null;
};

const hasMeaningfulFilters = (filters = null) =>
  isPlainObject(filters) && Object.keys(filters).length > 0;

const hasConditionSignals = (message = "") =>
  CONDITION_SIGNAL_PATTERN.test(normalizeLower(message));

const hasPlacementRecruitmentIntent = (message = "") => {
  const normalized = normalizeLower(message);
  if (!normalized) {
    return false;
  }

  if (/\b(recruited|hired|selected|offered|placed)\s+by\b/.test(normalized)) {
    return true;
  }

  if (
    PLACEMENT_RECRUITMENT_PATTERN.test(normalized) &&
    /\b(student|students|detail|details|list|who|company|companies)\b/.test(normalized)
  ) {
    return true;
  }

  return Boolean(
    extractCompany(message) &&
      (PLACEMENT_RECRUITMENT_PATTERN.test(normalized) ||
        /\b(student|students|detail|details|list|who)\b/.test(normalized))
  );
};

const detectEntity = (message = "") => {
  const normalized = normalizeLower(message);
  const mentionsDocumentDomain =
    /\bdocument\b|\bdocuments\b|\bfile\b|\bfiles\b|\bevidence\b/.test(normalized) ||
    (/\baccreditation\b/.test(normalized) && !/\bcriteria\b/.test(normalized));

  if (
    /\bfaculty achievement\b|\bfaculty achievements\b|\bachievement\b|\bachievements\b|\baward\b|\bawards\b|\bcertification\b|\bcertifications\b|\brecognition\b|\bgrant\b|\bpatent\b|\bfdp\b/.test(
      normalized
    )
  ) {
    return "achievements";
  }

  if (mentionsDocumentDomain) {
    return "documents";
  }

  if (/\bnaac\b|\bnaac criteria\b|\bcriterion\b.*\bnaac\b/.test(normalized)) {
    return "naac";
  }

  if (/\bnba\b|\bnba criteria\b|\bcriteria\b.*\bnba\b/.test(normalized)) {
    return "nba";
  }

  if (
    /\bresearch\s+papers?\b|\bresearch\b|\bpublications?\b|\bjournal\b|\bjournals\b|\bconference papers?\b|\bcitations?\b|\bimpact factor\b|\bdoi\b/.test(
      normalized
    )
  ) {
    return "research_papers";
  }

  if (
    /\bfaculty\b|\bfaculties\b|\bprofessor\b|\bprofessors\b|\bteacher\b|\bteachers\b|\blecturer\b|\blecturers\b|\bstaff\b|\bdesignation\b|\bspecialization\b|\bexperience\b|\bteach(?:es|ing)?\b/.test(
      normalized
    )
  ) {
    return "faculty";
  }

  if (
    /\bcourse\b|\bcourses\b|\bsubject\b|\bsubjects\b|\bsyllabus\b|\bmodule\b|\bmodules\b/.test(
      normalized
    )
  ) {
    return "courses";
  }

  if (
    /\bplacement rate\b/.test(normalized) &&
    /\bdepartment\b|\bdepartments\b|\bschool\b|\bschools\b|\bbranch\b|\bbranches\b/.test(
      normalized
    )
  ) {
    return "departments";
  }

  if (
    hasPlacementRecruitmentIntent(message) ||
    /\bplacement\b|\bplacements\b|\bplaced\b|\bpackage\b|\bpackages\b|\bcompany\b|\bcompanies\b|\bsalary\b|\bctc\b/.test(
      normalized
    )
  ) {
    return "placements";
  }

  if (
    /\bstudent\b|\bstudents\b|\broll number\b|\broll no\b|\bcgpa\b|\bgpa\b|\battendance\b|\bbacklogs?\b|\bsemester\b|\bbatch\b/.test(
      normalized
    )
  ) {
    return "students";
  }

  if (
    /\bevent\b|\bevents\b|\bworkshop\b|\bseminar\b|\bhackathon\b|\bconference\b|\bwebinar\b/.test(
      normalized
    )
  ) {
    return "events";
  }

  if (
    /\bdepartment\b|\bdepartments\b|\bschool\b|\bschools\b|\bbranch\b|\bbranches\b/.test(
      normalized
    )
  ) {
    return "departments";
  }

  if (/\buser\b|\busers\b|\baccount\b|\baccounts\b/.test(normalized)) {
    return "users";
  }

  return null;
};

const normalizeDepartmentValue = (value = "") => {
  const normalized = normalizeLower(value);
  if (!normalized) {
    return null;
  }

  return DEPARTMENT_ALIASES[normalized] || normalizeValueCase(value);
};

const extractDepartment = (message = "") => {
  const strictFilters = extractFilters(message);
  if (strictFilters.department) {
    return strictFilters.department;
  }

  const departmentMatch = captureValue(message, [
    /\b(?:department|dept)\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&\s-]{1,50})\b/i,
    /\b(?:from|for|in|of)\s+([A-Za-z][A-Za-z0-9&\s-]{1,50})\s+department\b/i,
    /\bbelongs to\s+([A-Za-z][A-Za-z0-9&\s-]{1,50})\s+department\b/i,
  ]);

  if (departmentMatch) {
    return normalizeDepartmentValue(departmentMatch);
  }

  const directCodeMatch = message.match(/\b(CSE|IT|ECE|MECH|CIVIL)\b/i);
  return directCodeMatch?.[1] ? directCodeMatch[1].toUpperCase() : null;
};

const extractSubject = (message = "") =>
  captureValue(message, [
    /\b(?:teach(?:es|ing)?|teaching|taught)\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|in|from|with|who|that|where|department|year|after|before|since|during|sorted|ordered|top|highest|lowest|best|worst|latest|oldest|limit)\b|$)/i,
    /\bsubject\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|in|from|with|department|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
    /\bcourse\s*(?:is|=|:|on|in)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|from|with|department|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
  ]);

const extractField = (message = "", entity = null) => {
  const patterns = [
    /\b(?:field|domain|area|topic)\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:for|from|with|by|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
    /\bwith\s+(?:field|domain|area|topic)\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:for|from|with|by|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
    /\b(?:research|papers?|publications?)\s+(?:in|on)\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:for|from|with|by|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
    /\bpublished\s+in\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:for|from|with|by|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
  ];

  const value = captureValue(message, patterns);
  if (value) {
    return normalizeValueCase(value);
  }

  if (entity !== "research_papers") {
    return null;
  }

  const inValue = captureValue(message, [
    /\bpapers?\s+in\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,40}?)(?=\s+(?:for|from|with|by|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
  ]);

  return inValue ? normalizeValueCase(inValue) : null;
};

const extractAuthor = (message = "") =>
  captureValue(message, [
    /\b(?:author|authors)\s*(?:is|are|=|:)?\s*([A-Za-z][A-Za-z.\s'-]{1,60}?)(?=\s+(?:in|from|with|year|sorted|ordered|top|highest|lowest)\b|$)/i,
    /\b(?:authored|written)\s+by\s+([A-Za-z][A-Za-z.\s'-]{1,60}?)(?=\s+(?:in|from|with|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractSpecialization = (message = "") =>
  captureValue(message, [
    /\bspecialization\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:for|in|from|with|department|year|sorted|ordered|top|highest|lowest)\b|$)/i,
    /\bspecialized in\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:for|from|with|department|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractDesignation = (message = "") =>
  captureValue(message, [
    /\bdesignation\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,40}?)(?=\s+(?:for|in|from|with|department|year|sorted|ordered|top|highest|lowest)\b|$)/i,
    /\b(?:as|who are)\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,40})\s+faculty\b/i,
  ]);

const extractCompany = (message = "", parsedQuery = null) =>
  extractPlacementCompany(message, parsedQuery);

const extractPlacementRole = (message = "") =>
  captureValue(message, [
    /\brole\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|in|from|with|company|drive|year|status|top|highest|lowest)\b|$)/i,
    /\bas\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:at|in|for|with|company|drive)\b|$)/i,
  ]);

const extractPlacementType = (message = "") =>
  captureValue(message, [/\b(on-campus|off-campus|ppo|pool campus)\b/i]);

const extractPlacementApplicationStatus = (message = "") =>
  captureValue(message, [
    /\b(applied|shortlisted|interview scheduled|selected|rejected|withdrawn)\b/i,
  ]);

const extractPlacementDriveStatus = (message = "") =>
  captureValue(message, [/\b(open|upcoming|closed)\b/i]);

const extractPlacementCgpaThreshold = (message = "") => {
  const matchedValue = captureValue(message, [
    /\b(?:min(?:imum)?\s+)?cgpa\s*(?:above|greater than|over|more than)\s*(\d+(?:\.\d+)?)\b/i,
    /\b(?:min(?:imum)?\s+)?cgpa\s*(?:at least|>=|not less than)\s*(\d+(?:\.\d+)?)\b/i,
    /\bcgpa\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)\b/i,
  ]);

  if (!matchedValue) {
    return null;
  }

  return Number(matchedValue);
};

const extractPlacementBacklogThreshold = (message = "") => {
  const matchedValue = captureValue(message, [
    /\b(?:max(?:imum)?\s+)?backlogs?\s*(?:at most|<=|up to|within)\s*(\d+)\b/i,
    /\b(?:max(?:imum)?\s+)?backlogs?\s*(?:is|=|:)\s*(\d+)\b/i,
  ]);

  if (!matchedValue) {
    return null;
  }

  return parseInt(matchedValue, 10);
};

const extractJournal = (message = "") =>
  captureValue(message, [
    /\b(?:journal|conference)\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.,\s]{1,70}?)(?=\s+(?:for|in|from|with|by|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractPublicationType = (message = "") =>
  captureValue(message, [
    /\b(?:publication type|type)\s*(?:is|=|:)?\s*(journal|conference|book chapter|patent)\b/i,
  ]);

const extractIndexing = (message = "") => {
  const value = captureValue(message, [
    /\bindex(?:ed|ing)?\s*(?:is|=|:)?\s*(SCI|SCOPUS|WOS|UGC|Others)\b/i,
  ]);

  return value ? value.toUpperCase() : null;
};

const extractCategory = (message = "") =>
  captureValue(message, [
    /\bcategory\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,40}?)(?=\s+(?:for|in|from|with|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractStatus = (message = "") =>
  captureValue(message, [
    /\bstatus\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,40}?)(?=\s+(?:for|in|from|with|year|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
    /\b(pending approval|data collection|report generation|not started|in progress|not met|approved|pending|rejected|archived|completed|met|exceeded|analysis|draft)\b/i,
  ]);

const extractAccreditationType = (message = "") =>
  captureValue(message, [
    /\baccreditation type\s*(?:is|=|:)?\s*(NAAC|NBA|Other)\b/i,
    /\b(NAAC|NBA)\s+documents?\b/i,
  ]);

const extractCriteria = (message = "", entity = null) => {
  const numericCriteria = captureValue(message, [
    /\bcriteria?\s*(?:number\s*)?([1-7])\b/i,
  ]);

  if (numericCriteria) {
    return numericCriteria;
  }

  if (!["documents", "naac", "nba"].includes(entity)) {
    return null;
  }

  return captureValue(message, [
    /\bcriteria?\s*(?:is|=|:|for)?\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:status|for|in|from|with|year|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
  ]);
};

const extractDocumentType = (message = "", entity = null) => {
  if (entity !== "documents") {
    return null;
  }

  return captureValue(message, [
    /\btype\s*(?:is|=|:)?\s*(NBA|NAAC|ISO|Internal|External|Policy|Report|Certificate|Agreement)\b/i,
    /\b(NBA|NAAC|ISO)\s+document\b/i,
  ]);
};

const extractAchievementType = (message = "", entity = null) => {
  if (entity !== "achievements") {
    return null;
  }

  return captureValue(message, [
    /\btype\s*(?:is|=|:)?\s*(Award|Certification|Recognition|Publication|Grant|Patent|Conference|Workshop|FDP)\b/i,
    /\b(award|certification|recognition|publication|grant|patent|conference|workshop|fdp)\b/i,
  ]);
};

const extractEventType = (message = "") =>
  captureValue(message, [
    /\bevent type\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,40}?)(?=\s+(?:for|in|from|with|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractLevel = (message = "") =>
  captureValue(message, [
    /\blevel\s*(?:is|=|:)\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,30}?)(?=\s+(?:for|in|from|with|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractSemester = (message = "") => {
  const value = captureValue(message, [
    /\bsemester\s*(?:is|=|:)?\s*(\d{1,2})\b/i,
  ]);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractRollNumber = (message = "") =>
  captureValue(message, [
    /\broll(?: number| no)?\s*(?:is|=|:)?\s*([A-Za-z0-9-]{2,30})\b/i,
  ]);

const extractNamedFilter = (message = "") =>
  captureValue(message, [
    /\b(?:named|name is|called)\s+([A-Za-z][A-Za-z.\s'-]{1,60}?)(?=\s+(?:for|in|from|with|department|year|sorted|ordered|top|highest|lowest)\b|$)/i,
  ]);

const extractBacklogFilter = (message = "") => {
  const normalized = normalizeLower(message);
  if (!/\bbacklog|backlogs\b/.test(normalized)) {
    return null;
  }

  if (
    /\b(?:without|no)\s+backlogs?\b/.test(normalized) ||
    /\bbacklogs?\s*(?:=|is|are)?\s*(?:false|no|none|zero)\b/.test(normalized)
  ) {
    return false;
  }

  if (
    /\b(?:with|has|have)\s+backlogs?\b/.test(normalized) ||
    /\bbacklogs?\s*(?:=|is|are)?\s*(?:true|yes)\b/.test(normalized)
  ) {
    return true;
  }

  return null;
};

const getNumericFieldCatalogs = (entity = "") => {
  switch (entity) {
    case "faculty":
      return [
        {
          target: "faculty",
          numericFields: ["experience"],
        },
      ];
    case "placements":
      return [
        {
          target: "placement",
          numericFields: ["package"],
        },
      ];
    case "departments":
      return [
        {
          target: "department",
          numericFields: ["averageCGPA", "averageAttendance", "placementPercentage"],
          fieldMap: {
            averageCGPA: "average_cgpa",
            averageAttendance: "attendance",
            placementPercentage: "placement_rate",
          },
        },
      ];
    case "research_papers":
      return [
        {
          target: "research_papers",
          numericFields: ["citations", "year", "impactFactor"],
          fieldMap: {
            impactFactor: "impact_factor",
          },
        },
      ];
    case "students":
      return [
        {
          target: "student",
          numericFields: [
            "cgpa",
            "academicRecords.avgAttendance",
            "currentBacklogs",
            "semester",
            "batchYear",
          ],
          fieldMap: {
            "academicRecords.avgAttendance": "attendance",
            currentBacklogs: "backlogs",
            batchYear: "batch_year",
          },
        },
      ];
    default:
      return [];
  }
};

const mergeFragment = (result = {}, fragment = {}) => {
  const next = { ...result };

  Object.entries(fragment).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (!(key in next)) {
      next[key] = value;
      return;
    }

    if (isPlainObject(next[key]) && isPlainObject(value)) {
      next[key] = {
        ...next[key],
        ...value,
      };
      return;
    }

    if (JSON.stringify(next[key]) === JSON.stringify(value)) {
      return;
    }

    const existing = Object.fromEntries(
      Object.entries(next).filter(([existingKey]) => existingKey !== key)
    );
    const fragments = [];

    if (Object.keys(existing).length) {
      fragments.push(existing);
    }

    fragments.push({ [key]: next[key] });
    fragments.push({ [key]: value });

    delete next[key];
    next.$and = fragments;
  });

  return next;
};

const mergeAndFragments = (fragments = []) =>
  fragments.reduce((result, fragment) => mergeFragment(result, fragment), {});

const buildTemporalFilter = (message = "") => {
  const betweenMatch = message.match(
    /\bbetween\s+((?:19|20)\d{2})\s+and\s+((?:19|20)\d{2})\b/i
  );

  if (betweenMatch) {
    const startYear = Number(betweenMatch[1]);
    const endYear = Number(betweenMatch[2]);

    return {
      year: {
        gte: Math.min(startYear, endYear),
        lte: Math.max(startYear, endYear),
      },
    };
  }

  const afterMatch = message.match(/\bafter\s+((?:19|20)\d{2})\b/i);

  if (afterMatch) {
    return {
      year: {
        gt: Number(afterMatch[1]),
      },
    };
  }

  const sinceMatch = message.match(/\b(?:since|from)\s+((?:19|20)\d{2})\b/i);

  if (sinceMatch) {
    return {
      year: {
        gte: Number(sinceMatch[1]),
      },
    };
  }

  const beforeMatch = message.match(/\b(?:before|until|upto|up to)\s+((?:19|20)\d{2})\b/i);

  if (beforeMatch) {
    return {
      year: {
        lt: Number(beforeMatch[1]),
      },
    };
  }

  const inYearMatch = message.match(
    /\b(?:year\s*(?:is|=|:)?|published in|in|during)\s+((?:19|20)\d{2})\b/i
  );

  if (inYearMatch && YEAR_PATTERN.test(inYearMatch[0])) {
    return {
      year: Number(inYearMatch[1]),
    };
  }

  return null;
};

const buildTextFilterFragments = (message = "", entity = null) => {
  const fragments = [];
  const department = extractDepartment(message);
  const subject =
    entity === "faculty" || entity === "courses" ? extractSubject(message) : null;
  const field = extractField(message, entity);
  const author = entity === "research_papers" ? extractAuthor(message) : null;
  const specialization =
    entity === "faculty" ? extractSpecialization(message) : null;
  const designation = entity === "faculty" ? extractDesignation(message) : null;
  const company = entity === "placements" ? extractCompany(message) : null;
  const journal = entity === "research_papers" ? extractJournal(message) : null;
  const publicationType =
    entity === "research_papers" ? extractPublicationType(message) : null;
  const indexing = entity === "research_papers" ? extractIndexing(message) : null;
  const category =
    entity === "achievements" || entity === "documents"
      ? extractCategory(message)
      : null;
  const eventType = entity === "events" ? extractEventType(message) : null;
  const level =
    entity === "events" || entity === "achievements"
      ? extractLevel(message)
      : null;
  const status =
    entity === "documents" || entity === "naac" || entity === "nba"
      ? extractStatus(message)
      : null;
  const accreditationType =
    entity === "documents" || entity === "naac" || entity === "nba"
      ? extractAccreditationType(message)
      : null;
  const criteria =
    entity === "documents" || entity === "naac" || entity === "nba"
      ? extractCriteria(message, entity)
      : null;
  const documentType = extractDocumentType(message, entity);
  const achievementType = extractAchievementType(message, entity);
  const yearContext = resolveYearFilterContext({ message, entity });
  const semester =
    entity === "students" || entity === "courses"
      ? extractSemester(message)
      : null;
  const rollNumber = entity === "students" ? extractRollNumber(message) : null;
  const name = extractNamedFilter(message);
  const backlogs = entity === "students" ? extractBacklogFilter(message) : null;
  const temporal = entity === "research_papers" ? buildTemporalFilter(message) : null;

  if (department) fragments.push({ department });
  if (subject) fragments.push({ subject });
  if (field) fragments.push({ field });
  if (author) fragments.push({ author });
  if (specialization) fragments.push({ specialization });
  if (designation) fragments.push({ designation });
  if (company) fragments.push({ company });
  if (journal) fragments.push({ journal });
  if (publicationType) fragments.push({ publication_type: publicationType });
  if (indexing) fragments.push({ indexing });
  if (category) fragments.push({ category });
  if (eventType) fragments.push({ event_type: eventType });
  if (level) fragments.push({ level });
  if (status) fragments.push({ status });
  if (accreditationType) fragments.push({ accreditation_type: accreditationType.toUpperCase() });
  if (criteria) fragments.push({ criteria });
  if (documentType) fragments.push({ type: documentType });
  if (achievementType) fragments.push({ type: achievementType });
  if (yearContext.academicYear) fragments.push({ academicYear: yearContext.academicYear });
  if (yearContext.batchYear !== null) fragments.push({ batchYear: yearContext.batchYear });
  if (yearContext.year !== null && yearContext.semantic === "year") {
    fragments.push({ year: yearContext.year });
  }
  if (yearContext.dateRange) fragments.push({ dateRange: yearContext.dateRange });
  if (semester !== null) fragments.push({ semester });
  if (rollNumber) fragments.push({ roll_number: rollNumber });
  if (name) fragments.push({ name });
  if (backlogs !== null) fragments.push({ backlogs });
  if (temporal) fragments.push(temporal);

  return fragments;
};

const buildValidationFallbackFilters = (message = "", entity = null) => {
  const fragments = [];

  if (entity === "faculty") {
    const subjectFromWhoClause = captureValue(message, [
      /\bwho\s+teach(?:es|ing)?\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|in|from|with|department|year|sorted|ordered|top|highest|lowest)\b|$)/i,
      /\bwho\s+taught\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|in|from|with|department|year|sorted|ordered|top|highest|lowest)\b|$)/i,
    ]);

    if (subjectFromWhoClause) {
      fragments.push({ subject: subjectFromWhoClause });
    }
  }

  if (entity === "research_papers") {
    const fieldFromPublishedClause = captureValue(message, [
      /\bpublished\s+in\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:by|for|from|with|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
      /\bwith\s+(?:field|domain|area|topic)\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,50}?)(?=\s+(?:by|for|from|with|year|after|before|since|during|sorted|ordered|top|highest|lowest|limit)\b|$)/i,
    ]);

    if (fieldFromPublishedClause) {
      fragments.push({ field: normalizeValueCase(fieldFromPublishedClause) });
    }
  }

  const departmentFromCondition = captureValue(message, [
    /\bin\s+department\s+([A-Za-z][A-Za-z0-9&\s-]{1,50})\b/i,
    /\bfrom\s+department\s+([A-Za-z][A-Za-z0-9&\s-]{1,50})\b/i,
  ]);

  if (departmentFromCondition) {
    fragments.push({ department: normalizeDepartmentValue(departmentFromCondition) });
  }

  return mergeAndFragments(fragments);
};

const buildNumericFilterFragments = (message = "", entity = null) => {
  const fieldCatalogs = getNumericFieldCatalogs(entity);
  if (!fieldCatalogs.length) {
    return {
      joiner: "$and",
      fragments: [],
    };
  }

  const numericMessage = normalizeText(message).replace(
    /\b(?:top|first|highest|lowest|least|best|worst)\s+\d+\b/gi,
    ""
  );

  const advancedFilters = parseAdvancedFilters(numericMessage, {
    fieldCatalogs,
  });

  const fragments = advancedFilters.conditions
    .map((condition) => {
      const key = toSnakeCase(condition.dbField || condition.field);
      const operator = FRIENDLY_OPERATOR_MAP[condition.operator] || condition.operator;

      if (!key || !operator) {
        return null;
      }

      return {
        [key]: {
          [operator]: condition.value,
        },
      };
    })
    .filter(Boolean);

  return {
    joiner: advancedFilters.joiner || "$and",
    fragments,
  };
};

const buildFilters = (message = "", entity = null) => {
  const textFragments = buildTextFilterFragments(message, entity);
  const numericFilters = buildNumericFilterFragments(message, entity);
  let filters = null;

  if (numericFilters.joiner === "$or" && numericFilters.fragments.length > 1) {
    const sharedFilters = mergeAndFragments(textFragments);
    const orGroup = { $or: numericFilters.fragments };

    if (!Object.keys(sharedFilters).length) {
      filters = orGroup;
    } else {
      filters = {
        $and: [sharedFilters, orGroup],
      };
    }
  } else {
    filters = mergeAndFragments([...textFragments, ...numericFilters.fragments]);
  }

  if (!hasMeaningfulFilters(filters) && hasConditionSignals(message)) {
    const fallbackFilters = buildValidationFallbackFilters(message, entity);
    if (hasMeaningfulFilters(fallbackFilters)) {
      return fallbackFilters;
    }
  }

  return filters;
};

const extractLimit = (message = "") => {
  const rankedMatch = normalizeText(message).match(
    /\b(?:top|best|first|highest|lowest|least|worst)\s+(\d+)\b/i
  );

  if (rankedMatch) {
    const parsed = parseInt(rankedMatch[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const explicitLimitMatch = normalizeText(message).match(/\blimit\s+(\d+)\b/i);
  if (!explicitLimitMatch) {
    return null;
  }

  const parsed = parseInt(explicitLimitMatch[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeSortField = (value = "", entity = null) => {
  const normalized = normalizeLower(value);

  if (!normalized) {
    return null;
  }

  if (/\bcitation/.test(normalized)) return "citations";
  if (/\bimpact factor\b/.test(normalized)) return "impact_factor";
  if (/\bpackage\b|\bsalary\b|\bctc\b/.test(normalized)) return "package";
  if (/\bexperience\b/.test(normalized)) return "experience";
  if (/\bpoints?\b/.test(normalized)) return "points";
  if (/\battendance\b/.test(normalized)) return "attendance";
  if (/\bcgpa\b|\bgpa\b|\bperformance\b/.test(normalized)) return "cgpa";
  if (/\bbacklog/.test(normalized)) return "backlogs";
  if (/\bplacement rate\b/.test(normalized)) return "placement_rate";
  if (/\baverage cgpa\b/.test(normalized)) return "average_cgpa";
  if (/\bstatus\b/.test(normalized)) return "status";
  if (/\bcompliance\b|\bscore\b/.test(normalized)) return "compliance_score";
  if (/\bname\b|\balphabet/.test(normalized)) return "name";
  if (/\byear\b/.test(normalized)) return "year";
  if (/\bdate\b|\blatest\b|\bnewest\b|\boldest\b|\bearliest\b/.test(normalized)) {
    return entity === "research_papers" ? "year" : "date";
  }

  return null;
};

const detectSortDirection = (message = "") => {
  const normalized = normalizeLower(message);

  if (
    /\b(?:ascending|asc|lowest|least|worst|oldest|earliest|alphabetical|alphabetically)\b/.test(
      normalized
    )
  ) {
    return "asc";
  }

  if (
    /\b(?:descending|desc|top|best|highest|most|latest|newest|recent)\b/.test(
      normalized
    )
  ) {
    return "desc";
  }

  return null;
};

const getFallbackSortField = (entity = null) => {
  switch (entity) {
    case "research_papers":
      return "relevance_or_citations";
    case "faculty":
      return "relevance_or_experience";
    case "students":
      return "relevance_or_cgpa";
    case "placements":
      return "relevance_or_package";
    case "departments":
      return "relevance_or_performance";
    case "events":
      return "relevance_or_date";
    case "achievements":
      return "relevance_or_date";
    case "documents":
      return "relevance_or_date";
    case "naac":
      return "relevance_or_status";
    case "nba":
      return "relevance_or_score";
    default:
      return "relevance";
  }
};

const extractExplicitSort = (message = "", entity = null) => {
  const match = message.match(
    /\b(?:sort|order)(?:ed)?\s+by\s+([A-Za-z][A-Za-z0-9\s_-]{1,40}?)(?:\s+(ascending|descending|asc|desc))?(?=\s*$|\s+(?:limit|for|from|with|in)\b)/i
  );

  if (!match) {
    return null;
  }

  const field = normalizeSortField(match[1], entity);
  const direction =
    match[2] && /\b(?:ascending|asc)\b/i.test(match[2]) ? "asc" : "desc";

  return field
    ? {
        [field]: direction,
      }
    : null;
};

const buildSort = (message = "", entity = null) => {
  const explicitSort = extractExplicitSort(message, entity);
  if (explicitSort) {
    return explicitSort;
  }

  const normalized = normalizeLower(message);
  if (entity === "students") {
    if (
      /\b(top|best|highest)\b/.test(normalized) &&
      !/\b(?:by|sort(?:ed)?\s+by|order(?:ed)?\s+by)\b/.test(normalized)
    ) {
      return {
        cgpa: "desc",
      };
    }

    if (
      /\b(low|lowest|least|worst)\b/.test(normalized) &&
      !/\b(?:by|sort(?:ed)?\s+by|order(?:ed)?\s+by)\b/.test(normalized)
    ) {
      return {
        cgpa: "asc",
      };
    }
  }

  if (entity === "placements") {
    if (
      /\b(top|best|highest)\b/.test(normalized) &&
      !/\b(?:by|sort(?:ed)?\s+by|order(?:ed)?\s+by)\b/.test(normalized)
    ) {
      return {
        package: "desc",
      };
    }
  }

  const direction = detectSortDirection(message);
  if (!direction) {
    return null;
  }

  const field = normalizeSortField(message, entity) || getFallbackSortField(entity);
  return field
    ? {
        [field]: direction,
      }
    : null;
};

const extractQueryParameters = (message = "") => {
  const normalizedMessage = stripPlanningInstruction(message);
  const logicalMessage = stripReportInstruction(normalizedMessage);
  const entity = detectEntity(logicalMessage);
  const baseFilters = buildFilters(logicalMessage, entity);
  const placementDomain = entity === "placements" ? detectPlacementDomain(logicalMessage) : null;
  const placementFilters =
    entity === "placements"
      ? {
          ...(extractCompany(logicalMessage) ? { company: extractCompany(logicalMessage) } : {}),
          ...(extractPlacementRole(logicalMessage)
            ? { role: extractPlacementRole(logicalMessage) }
            : {}),
          ...(extractPlacementType(logicalMessage)
            ? { placementType: extractPlacementType(logicalMessage) }
            : {}),
          ...(extractPlacementDriveStatus(logicalMessage)
            ? { status: extractPlacementDriveStatus(logicalMessage) }
            : {}),
          ...(extractPlacementApplicationStatus(logicalMessage)
            ? { applicationStatus: extractPlacementApplicationStatus(logicalMessage) }
            : {}),
          ...(extractPlacementCgpaThreshold(logicalMessage) !== null
            ? { minCgpa: extractPlacementCgpaThreshold(logicalMessage) }
            : {}),
          ...(extractPlacementBacklogThreshold(logicalMessage) !== null
            ? { maxBacklogs: extractPlacementBacklogThreshold(logicalMessage) }
            : {}),
        }
      : {};
  const filters = hasMeaningfulFilters(baseFilters) || Object.keys(placementFilters).length
    ? {
        ...(hasMeaningfulFilters(baseFilters) ? baseFilters : {}),
        ...placementFilters,
      }
    : baseFilters;
  const sort = buildSort(logicalMessage, entity);
  const limit = extractLimit(logicalMessage);
  const yearContext = resolveYearFilterContext({
    message: logicalMessage,
    entity,
    filters,
  });

  return {
    entity,
    filters,
    sort,
    limit,
    yearContext,
    placementDomain,
    hasFilters: hasMeaningfulFilters(filters),
  };
};

const shouldExtractQueryParameters = ({ message = "", payload = {} } = {}) => {
  const mode = normalizeLower(payload.mode || payload.queryMode || payload.queryType);

  if (PLAN_MODE_VALUES.has(mode) || payload.parameterExtractorOnly === true) {
    return true;
  }

  return QUERY_PARAMETER_REQUEST_PATTERN.test(normalizeText(message));
};

module.exports = {
  extractQueryParameters,
  shouldExtractQueryParameters,
};
