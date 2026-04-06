const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Subject = require("../models/Subject");
const Placement = require("../models/Placement");
const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const ResearchPaper = require("../models/ResearchPaper");
const FacultyAchievement = require("../models/FacultyAchievement");
const Department = require("../models/Department");
const Document = require("../models/Document");
const NAACCriteria = require("../models/NAACCriteria");
const NBACriteria = require("../models/NBACriteria");
const User = require("../models/User");
const { resolveMentionedDepartments } = require("./chatbotFilter.service");
const { getCollectionAliases, normalizeAlias } = require("./schemaRegistry.service");
const {
  applyRoleScopeToKnowledgePlan,
} = require("./chatbotAccessScope.service");
const {
  normalizeAcademicYear,
  resolveYearFilterContext,
} = require("./chatbotYearFilter.service");

const COLLECTIONS = {
  students: {
    model: Student,
    allowedFields: [
      "name",
      "rollNumber",
      "email",
      "batchYear",
      "currentSemester",
      "gender",
      "cgpa",
      "isAtRisk",
      "currentBacklogs",
      "totalBacklogsCleared",
      "phone",
      "isActive",
      "department",
    ],
    aliases: {
      departmentCode: "department",
      departmentName: "department",
    },
    populate: [{ path: "department", select: "name code" }],
    defaultSelect: [
      "name",
      "rollNumber",
      "email",
      "batchYear",
      "currentSemester",
      "cgpa",
      "isAtRisk",
      "currentBacklogs",
      "department",
    ],
  },
  faculties: {
    model: Faculty,
    allowedFields: [
      "name",
      "email",
      "designation",
      "qualification",
      "experience",
      "specialization",
      "phone",
      "isActive",
      "department",
    ],
    aliases: {
      departmentCode: "department",
      departmentName: "department",
    },
    populate: [{ path: "department", select: "name code" }],
    defaultSelect: [
      "name",
      "email",
      "designation",
      "qualification",
      "experience",
      "specialization",
      "department",
    ],
  },
  subjects: {
    model: Subject,
    allowedFields: [
      "name",
      "code",
      "semester",
      "credits",
      "type",
      "department",
      "faculty",
    ],
    aliases: {
      departmentCode: "department",
      departmentName: "department",
    },
    populate: [
      { path: "department", select: "name code" },
      { path: "faculty", select: "name email designation" },
    ],
    defaultSelect: [
      "name",
      "code",
      "semester",
      "credits",
      "type",
      "department",
      "faculty",
    ],
  },
  placements: {
    model: Placement,
    allowedFields: [
      "company",
      "package",
      "role",
      "placementDate",
      "placementType",
      "location",
      "academicYear",
      "isHighestPackage",
      "student",
    ],
    aliases: {
      studentRollNumber: "student",
      departmentCode: "student",
      departmentName: "student",
    },
    populate: [
      {
        path: "student",
        select: "name rollNumber department",
        populate: { path: "department", select: "name code" },
      },
    ],
    defaultSelect: [
      "company",
      "package",
      "role",
      "placementDate",
      "placementType",
      "location",
      "academicYear",
      "student",
    ],
  },
  attendances: {
    model: Attendance,
    allowedFields: [
      "semester",
      "academicYear",
      "attendedClasses",
      "totalClasses",
      "percentage",
      "isBelowThreshold",
      "student",
      "subject",
    ],
    aliases: {
      studentRollNumber: "student",
      subjectCode: "subject",
    },
    populate: [
      {
        path: "student",
        select: "name rollNumber department",
        populate: { path: "department", select: "name code" },
      },
      { path: "subject", select: "name code semester" },
    ],
    defaultSelect: [
      "semester",
      "academicYear",
      "percentage",
      "isBelowThreshold",
      "student",
      "subject",
    ],
  },
  marks: {
    model: Marks,
    allowedFields: [
      "semester",
      "academicYear",
      "internal",
      "external",
      "total",
      "grade",
      "result",
      "gradePoints",
      "student",
      "subject",
    ],
    aliases: {
      studentRollNumber: "student",
      subjectCode: "subject",
    },
    populate: [
      {
        path: "student",
        select: "name rollNumber department",
        populate: { path: "department", select: "name code" },
      },
      { path: "subject", select: "name code semester" },
    ],
    defaultSelect: [
      "semester",
      "academicYear",
      "total",
      "grade",
      "result",
      "gradePoints",
      "student",
      "subject",
    ],
  },
  researchpapers: {
    model: ResearchPaper,
    allowedFields: [
      "title",
      "journal",
      "year",
      "citations",
      "publicationType",
      "indexing",
      "doi",
      "impactFactor",
      "faculty",
      "department",
    ],
    aliases: {
      departmentCode: "department",
      departmentName: "department",
    },
    populate: [
      {
        path: "faculty",
        select: "name department",
        populate: { path: "department", select: "name code" },
      },
      { path: "department", select: "name code" },
    ],
    defaultSelect: [
      "title",
      "journal",
      "year",
      "citations",
      "publicationType",
      "indexing",
      "impactFactor",
      "faculty",
      "department",
    ],
  },
  facultyachievements: {
    model: FacultyAchievement,
    allowedFields: [
      "type",
      "title",
      "description",
      "issuingOrganization",
      "date",
      "level",
      "category",
      "points",
      "isActive",
      "faculty",
    ],
    aliases: {
      departmentCode: "faculty",
      departmentName: "faculty",
      academicYear: "date",
    },
    populate: [
      {
        path: "faculty",
        select: "name department designation",
        populate: { path: "department", select: "name code" },
      },
    ],
    defaultSelect: [
      "type",
      "title",
      "issuingOrganization",
      "date",
      "level",
      "category",
      "points",
      "faculty",
    ],
  },
  departments: {
    model: Department,
    allowedFields: ["name", "code", "establishedYear", "totalSeats", "isActive"],
    defaultSelect: ["name", "code", "establishedYear", "totalSeats", "isActive"],
  },
  documents: {
    model: Document,
    allowedFields: [
      "title",
      "description",
      "category",
      "subCategory",
      "type",
      "accreditationType",
      "criteria",
      "academicYear",
      "version",
      "accessLevel",
      "status",
      "isRequiredForAccreditation",
      "isActive",
      "department",
      "program",
      "student",
      "uploadedBy",
    ],
    aliases: {
      departmentCode: "department",
      departmentName: "department",
    },
    populate: [
      { path: "department", select: "name code" },
      { path: "program", select: "name code" },
      { path: "student", select: "name rollNumber" },
    ],
    defaultSelect: [
      "title",
      "category",
      "type",
      "accreditationType",
      "criteria",
      "academicYear",
      "status",
      "department",
      "program",
    ],
  },
  naaccriterias: {
    model: NAACCriteria,
    allowedFields: [
      "institution",
      "academicYear",
      "criterion",
      "keyIndicator",
      "metric",
      "status",
      "complianceLevel",
      "lastUpdated",
      "isActive",
    ],
    defaultSelect: [
      "institution",
      "academicYear",
      "criterion",
      "keyIndicator",
      "metric",
      "status",
      "complianceLevel",
      "lastUpdated",
    ],
  },
  nbacriterias: {
    model: NBACriteria,
    allowedFields: [
      "program",
      "academicYear",
      "criteria",
      "title",
      "targetValue",
      "actualValue",
      "threshold",
      "unit",
      "status",
      "complianceScore",
      "lastUpdated",
      "isActive",
    ],
    aliases: {
      departmentCode: "program",
      departmentName: "program",
    },
    populate: [{ path: "program", select: "name code" }],
    defaultSelect: [
      "program",
      "academicYear",
      "criteria",
      "title",
      "targetValue",
      "actualValue",
      "status",
      "complianceScore",
      "lastUpdated",
    ],
  },
  users: {
    model: User,
    allowedFields: [
      "name",
      "email",
      "role",
      "isActive",
      "department",
      "createdAt",
      "updatedAt",
    ],
    aliases: {
      departmentCode: "department",
      departmentName: "department",
    },
    populate: [{ path: "department", select: "name code" }],
    defaultSelect: ["name", "email", "role", "isActive", "department", "createdAt"],
  },
};

const COLLECTION_DETECTION_PRIORITY = [
  "facultyachievements",
  "naaccriterias",
  "nbacriterias",
  "documents",
  "researchpapers",
  "placements",
  "attendances",
  "marks",
  "subjects",
  "faculties",
  "students",
  "departments",
  "users",
];

const NAAC_CRITERION_BY_NUMBER = {
  "1": "Curricular Aspects",
  "2": "Teaching-Learning and Evaluation",
  "3": "Research, Consultancy and Extension",
  "4": "Infrastructure and Learning Resources",
  "5": "Student Support and Progression",
  "6": "Governance, Leadership and Management",
  "7": "Innovations and Best Practices",
};

const DOCUMENT_STATUS_VALUES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "Archived",
];
const NAAC_STATUS_VALUES = [
  "Data Collection",
  "Analysis",
  "Report Generation",
  "Completed",
];
const NBA_STATUS_VALUES = [
  "Not Started",
  "In Progress",
  "Met",
  "Not Met",
  "Exceeded",
];
const ACHIEVEMENT_LEVEL_VALUES = [
  "International",
  "National",
  "State",
  "Institutional",
];
const ACHIEVEMENT_CATEGORY_VALUES = [
  "Academic",
  "Research",
  "Teaching",
  "Service",
  "Professional Development",
];
const ACHIEVEMENT_TYPE_VALUES = [
  "Award",
  "Certification",
  "Recognition",
  "Publication",
  "Grant",
  "Patent",
  "Conference",
  "Workshop",
  "FDP",
];
const DOCUMENT_TYPE_VALUES = [
  "NBA",
  "NAAC",
  "ISO",
  "Internal",
  "External",
  "Policy",
  "Report",
  "Certificate",
  "Agreement",
];
const DOCUMENT_ACCREDITATION_VALUES = ["NBA", "NAAC", "Other"];
const RESEARCH_PUBLICATION_TYPE_VALUES = [
  "Journal",
  "Conference",
  "Book Chapter",
  "Patent",
];
const RESEARCH_INDEXING_VALUES = ["SCI", "SCOPUS", "WOS", "UGC", "Others"];

const ROLL_PATTERN = /\b([A-Za-z]{2,10}\d{4,})\b/g;
const SUBJECT_CODE_PATTERN = /\b([A-Z]{2,6}\d{3}[A-Z]?)\b/g;
const SINGLE_ROLL_PATTERN = /\b([A-Za-z]{2,10}\d{4,})\b/;
const SINGLE_SUBJECT_CODE_PATTERN = /\b([A-Z]{2,6}\d{3}[A-Z]?)\b/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ACADEMIC_YEAR_PATTERN = /(20\d{2})\s*-\s*(\d{2,4})/i;
const SEMESTER_PATTERN = /semester\s*(\d{1,2})/i;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;
const TOP_PATTERN = /\btop\s+(\d+)\b/i;

const escapeRegex = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCaseInsensitiveExactMatch = (field, value) => ({
  [field]: {
    $regex: `^${escapeRegex(String(value || "").trim())}$`,
    $options: "i",
  },
});

const parseAcademicYearValue = (value = "") => {
  const match = String(value || "").match(ACADEMIC_YEAR_PATTERN);
  if (!match) {
    return null;
  }

  const start = match[1];
  const endRaw = match[2];
  const end = endRaw.length === 4 ? endRaw.slice(2) : endRaw;
  return `${start}-${end}`;
};

const buildAcademicYearDateRange = (academicYear = "") => {
  const match = String(academicYear || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const startYear = Number(match[1]);
  return {
    $gte: new Date(`${startYear}-07-01T00:00:00.000Z`),
    $lt: new Date(`${startYear + 1}-07-01T00:00:00.000Z`),
  };
};

const extractRecognizedValue = (message = "", values = []) => {
  const normalizedMessage = normalizeAlias(message);

  for (const value of values) {
    const normalizedValue = normalizeAlias(value);
    if (!normalizedValue) {
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegex(normalizedValue)}\\b`, "i");
    if (pattern.test(normalizedMessage)) {
      return value;
    }
  }

  return null;
};

const extractCriteriaFilter = (message = "", collectionName = "") => {
  const numericMatch = message.match(/\bcriteria?\s*(?:number\s*)?([1-7])\b/i);
  if (numericMatch) {
    if (collectionName === "naaccriterias") {
      return {
        field: "criterion",
        operator: "eq",
        value: NAAC_CRITERION_BY_NUMBER[numericMatch[1]],
      };
    }

    return { field: "criteria", operator: "contains", value: numericMatch[1] };
  }

  const namedMatch = message.match(
    /\bcriteria?\s*(?:is|=|:|for)?\s*([A-Za-z][A-Za-z0-9\s&/-]{2,60})\b/i
  );
  if (!namedMatch) {
    return null;
  }

  const rawValue = String(namedMatch[1] || "")
    .replace(/\b(status|report|summary|documents?|evidence)\b.*$/i, "")
    .trim();
  if (!rawValue) {
    return null;
  }

  if (collectionName === "naaccriterias") {
    const mappedNaacCriterion =
      Object.values(NAAC_CRITERION_BY_NUMBER).find((criterion) =>
        normalizeAlias(criterion).includes(normalizeAlias(rawValue))
      ) || rawValue;
    return { field: "criterion", operator: "contains", value: mappedNaacCriterion };
  }

  return { field: "criteria", operator: "contains", value: rawValue };
};

const resolveDepartmentIds = async (value) => {
  const regex = new RegExp(value, "i");
  const departments = await Department.find({
    $or: [{ code: regex }, { name: regex }],
  }).select("_id");
  return departments.map((item) => item._id);
};

const resolveStudentIds = async (value) => {
  const regex = new RegExp(value, "i");
  const students = await Student.find({
    $or: [{ rollNumber: regex }, { name: regex }, { email: regex }],
  }).select("_id");
  return students.map((item) => item._id);
};

const resolveSubjectIds = async (value) => {
  const regex = new RegExp(value, "i");
  const subjects = await Subject.find({
    $or: [{ code: regex }, { name: regex }],
  }).select("_id");
  return subjects.map((item) => item._id);
};

const resolveFacultyIdsByDepartment = async (departmentIds = []) => {
  if (!departmentIds.length) {
    return [];
  }

  return Faculty.find({ department: { $in: departmentIds } }).distinct("_id");
};

const buildFilterFragment = async (collectionName, filter) => {
  const config = COLLECTIONS[collectionName];
  if (!config) return null;

  const field = filter.field;
  const operator = filter.operator || "eq";
  const value = filter.value;

  if (!field || value === undefined || value === null) {
    return null;
  }

  if (field === "departmentCode" || field === "departmentName") {
    const ids = await resolveDepartmentIds(String(value));
    if (!ids.length) return { _id: null };

    if (["students", "faculties", "subjects", "users"].includes(collectionName)) {
      return { department: { $in: ids } };
    }

    if (collectionName === "documents") {
      return {
        $or: [{ department: { $in: ids } }, { program: { $in: ids } }],
      };
    }

    if (collectionName === "researchpapers") {
      return { department: { $in: ids } };
    }

    if (collectionName === "facultyachievements") {
      const facultyIds = await resolveFacultyIdsByDepartment(ids);
      return facultyIds.length ? { faculty: { $in: facultyIds } } : { _id: null };
    }

    if (collectionName === "placements") {
      const studentIds = await Student.find({ department: { $in: ids } }).distinct("_id");
      return studentIds.length ? { student: { $in: studentIds } } : { _id: null };
    }

    if (["attendances", "marks"].includes(collectionName)) {
      const studentIds = await Student.find({ department: { $in: ids } }).distinct("_id");
      return studentIds.length ? { student: { $in: studentIds } } : { _id: null };
    }

    if (collectionName === "departments") {
      return { _id: { $in: ids } };
    }

    if (collectionName === "nbacriterias") {
      return { program: { $in: ids } };
    }

    return { _id: null };
  }

  if (field === "studentRollNumber") {
    const ids = await resolveStudentIds(String(value));
    return ids.length ? { student: { $in: ids } } : { _id: null };
  }

  if (field === "subjectCode") {
    const ids = await resolveSubjectIds(String(value));
    return ids.length ? { subject: { $in: ids } } : { _id: null };
  }

  if (field === "academicYear" && collectionName === "facultyachievements") {
    const range = buildAcademicYearDateRange(String(value));
    return range ? { date: range } : null;
  }

  if (field === "dateRange") {
    if (collectionName === "facultyachievements") {
      return { date: value };
    }

    if (collectionName === "events") {
      return { startDate: value };
    }

    return null;
  }

  if (field === "status" && ["documents", "naaccriterias", "nbacriterias"].includes(collectionName)) {
    return buildCaseInsensitiveExactMatch("status", value);
  }

  if (field === "accreditationType" && collectionName === "documents") {
    return buildCaseInsensitiveExactMatch("accreditationType", value);
  }

  if (field === "criterion" && collectionName === "naaccriterias") {
    return buildCaseInsensitiveExactMatch("criterion", value);
  }

  if (field === "criteria" && ["documents", "nbacriterias"].includes(collectionName)) {
    return {
      criteria: {
        $regex: escapeRegex(String(value)),
        $options: "i",
      },
    };
  }

  const actualField = config.aliases?.[field] || field;
  if (!config.allowedFields.includes(actualField)) {
    return null;
  }

  if (operator === "contains") {
    return { [actualField]: { $regex: String(value), $options: "i" } };
  }

  if (operator === "in" && Array.isArray(value)) {
    return { [actualField]: { $in: value } };
  }

  if (operator === "gte") return { [actualField]: { $gte: value } };
  if (operator === "lte") return { [actualField]: { $lte: value } };
  if (operator === "gt") return { [actualField]: { $gt: value } };
  if (operator === "lt") return { [actualField]: { $lt: value } };

  if (
    typeof value === "string" &&
    [
      "status",
      "level",
      "category",
      "type",
      "criterion",
      "criteria",
      "accreditationType",
    ].includes(actualField)
  ) {
    return buildCaseInsensitiveExactMatch(actualField, value);
  }

  return { [actualField]: value };
};

const sanitizeSelection = (collectionName, select = []) => {
  const config = COLLECTIONS[collectionName];
  const requested =
    Array.isArray(select) && select.length ? select : config.defaultSelect;
  return requested.filter((field) =>
    config.allowedFields.includes(config.aliases?.[field] || field)
  );
};

const sanitizeDocument = (doc) => {
  if (!doc || typeof doc !== "object") return doc;
  if (doc instanceof Date) return doc.toISOString();
  if (doc?._bsontype === "ObjectId" && typeof doc.toString === "function") {
    return doc.toString();
  }
  if (Array.isArray(doc)) return doc.map(sanitizeDocument);

  const result = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "password" || key === "__v") continue;
    result[key] = sanitizeDocument(value);
  }
  return result;
};

const messageMentionsCollection = (message = "", collectionName = "") =>
  getCollectionAliases(collectionName).some((alias) => {
    if (!alias) {
      return false;
    }

    const pattern = new RegExp(`\\b${escapeRegex(normalizeAlias(alias))}\\b`, "i");
    return pattern.test(normalizeAlias(message));
  });

const detectCollection = (message) => {
  const normalized = normalizeAlias(message);
  const mentionsDocumentDomain =
    /\bdocument\b|\bdocuments\b|\bfile\b|\bfiles\b|\bevidence\b/.test(normalized) ||
    (/\baccreditation\b/.test(normalized) && !/\bcriteria\b/.test(normalized));

  if (/\bfaculty achievements?\b|\bachievements?\b|\bawards?\b|\bcertifications?\b|\brecognitions?\b|\bgrants?\b|\bpatents?\b|\bfdp\b/.test(normalized)) {
    return "facultyachievements";
  }

  if (mentionsDocumentDomain) {
    return "documents";
  }

  if (/\bnaac\b/.test(normalized)) {
    return "naaccriterias";
  }

  if (/\bnba\b/.test(normalized)) {
    return "nbacriterias";
  }

  for (const collectionName of COLLECTION_DETECTION_PRIORITY) {
    if (messageMentionsCollection(message, collectionName)) {
      return collectionName;
    }
  }

  if (SINGLE_ROLL_PATTERN.test(message)) return "students";
  if (SINGLE_SUBJECT_CODE_PATTERN.test(message)) return "subjects";
  if (EMAIL_PATTERN.test(message)) {
    return /\brole\b|\badmin\b/.test(normalized) ? "users" : "students";
  }

  return null;
};

const detectOperation = (message) => {
  const normalized = String(message || "").toLowerCase().trim();
  if (
    normalized.includes("how many") ||
    /\bcount\b/.test(normalized) ||
    /^(?:what(?:'s| is)\s+)?total\b/.test(normalized) ||
    /\bnumber of\b/.test(normalized)
  ) {
    return "count";
  }

  if (
    /\b(list|show|find|get|give|return|display|pending|approved|rejected|archived|latest|recent|newest|top)\b/.test(
      normalized
    ) ||
    /\b(students|faculties|subjects|placements|papers|publications|documents|records|achievements|criteria|users)\b/.test(
      normalized
    )
  ) {
    return "findMany";
  }

  return "findOne";
};

const detectLimit = (message, operation) => {
  if (operation !== "findMany") {
    return 1;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("show all") ||
    normalized.includes("all students") ||
    normalized.includes("all records")
  ) {
    return 50;
  }

  const topMatch = message.match(TOP_PATTERN);
  if (topMatch) {
    return Math.min(Number(topMatch[1]), 50);
  }

  return 10;
};

const detectSelectFields = (collectionName, message) => {
  const normalized = message.toLowerCase();
  const allowed = COLLECTIONS[collectionName]?.allowedFields || [];
  const selected = allowed.filter((field) =>
    normalized.includes(field.toLowerCase())
  );

  if (normalized.includes("phone") && allowed.includes("phone")) selected.push("phone");
  if (normalized.includes("email") && allowed.includes("email")) selected.push("email");
  if (normalized.includes("role") && allowed.includes("role")) selected.push("role");
  if (normalized.includes("specialization") && allowed.includes("specialization")) selected.push("specialization");
  if (normalized.includes("designation") && allowed.includes("designation")) selected.push("designation");
  if (normalized.includes("qualification") && allowed.includes("qualification")) selected.push("qualification");
  if (normalized.includes("experience") && allowed.includes("experience")) selected.push("experience");
  if (normalized.includes("credit") && allowed.includes("credits")) selected.push("credits");
  if (normalized.includes("status") && allowed.includes("status")) selected.push("status");
  if (normalized.includes("criteria") && allowed.includes("criteria")) selected.push("criteria");
  if (normalized.includes("criterion") && allowed.includes("criterion")) selected.push("criterion");
  if (normalized.includes("level") && allowed.includes("level")) selected.push("level");
  if (normalized.includes("points") && allowed.includes("points")) selected.push("points");
  if (normalized.includes("compliance") && allowed.includes("complianceScore")) selected.push("complianceScore");

  return [...new Set(selected)];
};

const detectFilters = async (collectionName, message) => {
  const filters = [];
  const rollMatches = [...message.matchAll(ROLL_PATTERN)].map((match) =>
    match[1].toUpperCase()
  );
  const subjectMatches = [...message.matchAll(SUBJECT_CODE_PATTERN)].map((match) =>
    match[1].toUpperCase()
  );
  const emailMatch = message.match(EMAIL_PATTERN)?.[0]?.toLowerCase();
  const semesterMatch = message.match(SEMESTER_PATTERN);
  const yearContext = resolveYearFilterContext({
    message,
    entity: collectionName,
  });

  if (rollMatches.length) {
    if (collectionName === "students") {
      filters.push({ field: "rollNumber", operator: "eq", value: rollMatches[0] });
    }

    if (["placements", "attendances", "marks", "documents"].includes(collectionName)) {
      filters.push({
        field: "studentRollNumber",
        operator: "eq",
        value: rollMatches[0],
      });
    }
  }

  if (subjectMatches.length) {
    if (collectionName === "subjects") {
      filters.push({ field: "code", operator: "eq", value: subjectMatches[0] });
    }

    if (["attendances", "marks"].includes(collectionName)) {
      filters.push({
        field: "subjectCode",
        operator: "eq",
        value: subjectMatches[0],
      });
    }
  }

  if (emailMatch && ["students", "faculties", "users"].includes(collectionName)) {
    filters.push({ field: "email", operator: "eq", value: emailMatch });
  }

  if (yearContext.batchYear !== null && collectionName === "students") {
    filters.push({
      field: "batchYear",
      operator: "eq",
      value: yearContext.batchYear,
    });
  }

  if (
    yearContext.academicYear &&
    [
      "placements",
      "attendances",
      "marks",
      "documents",
      "facultyachievements",
      "naaccriterias",
      "nbacriterias",
    ].includes(collectionName)
  ) {
    filters.push({
      field: "academicYear",
      operator: "eq",
      value: normalizeAcademicYear(yearContext.academicYear),
    });
  }

  if (
    yearContext.dateRange &&
    ["facultyachievements", "events"].includes(collectionName)
  ) {
    filters.push({
      field: "dateRange",
      operator: "eq",
      value: yearContext.dateRange,
    });
  }

  if (
    semesterMatch &&
    ["students", "subjects", "attendances", "marks"].includes(collectionName)
  ) {
    const field = collectionName === "students" ? "currentSemester" : "semester";
    filters.push({ field, operator: "eq", value: Number(semesterMatch[1]) });
  }

  const mentionedDepartments = await resolveMentionedDepartments(message);
  for (const dept of mentionedDepartments) {
    if (
      [
        "students",
        "faculties",
        "subjects",
        "documents",
        "researchpapers",
        "facultyachievements",
        "nbacriterias",
      ].includes(collectionName)
    ) {
      filters.push({ field: "departmentCode", operator: "eq", value: dept.code });
    }

    if (["placements", "attendances", "marks"].includes(collectionName)) {
      filters.push({ field: "departmentCode", operator: "eq", value: dept.code });
    }

    if (collectionName === "departments") {
      filters.push({ field: "code", operator: "eq", value: dept.code });
    }
  }

  const companyMatch = message.match(/company\s+([A-Za-z0-9 .&-]+)/i);
  if (companyMatch && collectionName === "placements") {
    filters.push({
      field: "company",
      operator: "contains",
      value: companyMatch[1].trim(),
    });
  }

  const nameMatch = message.match(/(?:of|for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (collectionName === "faculties") {
      filters.push({ field: "name", operator: "contains", value: name });
    }
    if (collectionName === "students") {
      filters.push({ field: "name", operator: "contains", value: name });
    }
  }

  const statusValue =
    collectionName === "documents"
      ? extractRecognizedValue(message, DOCUMENT_STATUS_VALUES)
      : collectionName === "naaccriterias"
        ? extractRecognizedValue(message, NAAC_STATUS_VALUES)
        : collectionName === "nbacriterias"
          ? extractRecognizedValue(message, NBA_STATUS_VALUES)
          : null;
  if (statusValue) {
    filters.push({ field: "status", operator: "eq", value: statusValue });
  }

  const accreditationTypeValue =
    collectionName === "documents"
      ? extractRecognizedValue(message, DOCUMENT_ACCREDITATION_VALUES)
      : null;
  if (accreditationTypeValue) {
    filters.push({
      field: "accreditationType",
      operator: "eq",
      value: accreditationTypeValue,
    });
  }

  const criteriaFilter = extractCriteriaFilter(message, collectionName);
  if (criteriaFilter) {
    filters.push(criteriaFilter);
  }

  if (collectionName === "facultyachievements") {
    const level = extractRecognizedValue(message, ACHIEVEMENT_LEVEL_VALUES);
    const category = extractRecognizedValue(message, ACHIEVEMENT_CATEGORY_VALUES);
    const type = extractRecognizedValue(message, ACHIEVEMENT_TYPE_VALUES);

    if (level) filters.push({ field: "level", operator: "eq", value: level });
    if (category) filters.push({ field: "category", operator: "eq", value: category });
    if (type) filters.push({ field: "type", operator: "eq", value: type });
  }

  if (collectionName === "documents") {
    const type = extractRecognizedValue(message, DOCUMENT_TYPE_VALUES);
    const category = message.match(/\bcategory\s+([A-Za-z][A-Za-z\s&-]{2,40})\b/i)?.[1];

    if (type) filters.push({ field: "type", operator: "eq", value: type });
    if (category) {
      filters.push({ field: "category", operator: "contains", value: category.trim() });
    }
  }

  if (collectionName === "researchpapers") {
    const publicationType = extractRecognizedValue(
      message,
      RESEARCH_PUBLICATION_TYPE_VALUES
    );
    const indexing = extractRecognizedValue(message, RESEARCH_INDEXING_VALUES);
    const journalMatch = message.match(
      /\b(?:journal|conference)\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&/+\-.,\s]{2,70})\b/i
    );
    if (publicationType) {
      filters.push({
        field: "publicationType",
        operator: "eq",
        value: publicationType,
      });
    }

    if (indexing) {
      filters.push({ field: "indexing", operator: "eq", value: indexing });
    }

    if (journalMatch) {
      filters.push({
        field: "journal",
        operator: "contains",
        value: journalMatch[1].trim(),
      });
    }

    if (yearContext.year !== null) {
      filters.push({ field: "year", operator: "eq", value: yearContext.year });
    }
  }

  return filters;
};

const buildLocalQueryPlan = async (message) => {
  const collection = detectCollection(message);
  if (!collection || !COLLECTIONS[collection]) return null;

  const operation = detectOperation(message);
  let select = detectSelectFields(collection, message);
  const filters = await detectFilters(collection, message);
  const limit = detectLimit(message, operation);

  if (operation === "findMany" && select.length < 2) {
    select = [];
  }

  return {
    queries: [
      {
        collection,
        operation,
        filters,
        select,
        limit,
      },
    ],
  };
};

const executeQuery = async (query) => {
  const config = COLLECTIONS[query.collection];
  if (!config) return null;

  const fragments = await Promise.all(
    (query.filters || []).map((filter) =>
      buildFilterFragment(query.collection, filter)
    )
  );
  const match = fragments.filter(Boolean).length
    ? { $and: fragments.filter(Boolean) }
    : {};
  const selectFields = sanitizeSelection(query.collection, query.select);
  const limit = Math.min(Math.max(Number(query.limit) || 5, 1), 50);

  if (query.operation === "count") {
    const count = await config.model.countDocuments(match);
    return { operation: "count", count };
  }

  let mongoQuery = config.model.find(match).select(selectFields.join(" "));

  if (config.populate) {
    for (const populate of config.populate) {
      mongoQuery = mongoQuery.populate(populate);
    }
  }

  if (
    query.sort?.field &&
    sanitizeSelection(query.collection, [query.sort.field]).length
  ) {
    const sortOrder = query.sort.order === "asc" ? 1 : -1;
    mongoQuery = mongoQuery.sort({ [query.sort.field]: sortOrder });
  }

  if (query.operation === "findOne") {
    const doc = await mongoQuery.limit(1).lean();
    return { operation: "findOne", document: sanitizeDocument(doc[0] || null) };
  }

  const docs = await mongoQuery.limit(limit).lean();
  return { operation: "findMany", documents: sanitizeDocument(docs) };
};

const executeDatabaseKnowledgeQuery = async (message, accessScope = null) => {
  try {
    const basePlan = await buildLocalQueryPlan(message);
    const scopedPlanResult = await applyRoleScopeToKnowledgePlan({
      plan: basePlan,
      message,
      accessScope,
    });
    if (scopedPlanResult?.accessDenied) {
      return {
        accessDenied: true,
        message: scopedPlanResult.message,
        reason: scopedPlanResult.reason,
      };
    }

    const plan = scopedPlanResult?.plan || basePlan;
    if (!plan || !plan.queries?.length) {
      return null;
    }

    const limitedQueries = plan.queries
      .slice(0, 3)
      .filter((query) => COLLECTIONS[query.collection]);
    if (!limitedQueries.length) {
      return null;
    }

    const results = [];
    for (const query of limitedQueries) {
      const result = await executeQuery(query);
      results.push({
        query,
        result,
      });
    }

    return { plan: { queries: limitedQueries }, results };
  } catch (error) {
    console.error("Database knowledge query error:", error.message);
    return null;
  }
};

module.exports = {
  executeDatabaseKnowledgeQuery,
};
