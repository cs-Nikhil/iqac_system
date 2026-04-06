const mongoose = require("mongoose");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Subject = require("../models/Subject");
const Marks = require("../models/Marks");
const Attendance = require("../models/Attendance");
const { resolveMentionedDepartments } = require("./chatbotFilter.service");
const { normalizeEntityKey } = require("./chatbotYearFilter.service");
const { detectPlacementDomain } = require("./chatbotPlacement.service");

const ROLL_NUMBER_PATTERN = /\b([A-Za-z]{2,10}\d{2,})\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SELF_REFERENCE_PATTERN = /\b(my|me|mine|myself|own|personal)\b/i;
const BROAD_SCOPE_PATTERN =
  /\b(compare|comparison|top|highest|lowest|best|worst|rank|ranking|all|list|count|how many|number of|total|department(?:\s|-)?wise|institution(?:al)?|overall|analytics?|analysis|statistics|summary)\b/i;
const REPORT_SCOPE_PATTERN = /\b(report|reports?)\b/i;

const FULL_ACCESS_ROLES = new Set(["staff", "iqac_admin"]);
const STUDENT_OWNED_ENTITIES = new Set([
  "student",
  "attendance",
  "mark",
  "placement",
  "document",
  "participation",
]);
const HOD_SCOPED_ENTITIES = new Set([
  "student",
  "faculty",
  "department",
  "placement",
  "attendance",
  "mark",
  "subject",
  "research",
  "achievement",
  "document",
  "nba",
  "event",
]);
const FACULTY_SELF_ENTITIES = new Set([
  "faculty",
  "subject",
  "research",
  "achievement",
  "document",
  "attendance",
  "mark",
  "student",
]);
const STUDENT_PUBLIC_ENTITIES = new Set(["event"]);

const toObjectId = (value = null) =>
  value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value || null;

const toIdString = (value = null) => (value ? String(value) : null);

const uniqIds = (values = []) => [...new Set(values.map((value) => String(value)).filter(Boolean))];

const toObjectIdList = (values = []) =>
  uniqIds(values).map((value) => new mongoose.Types.ObjectId(value));

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeDepartmentCode = (value = null) =>
  value ? String(value).trim().toUpperCase() : null;

const cloneParsedQuery = (parsedQuery = null) => {
  const cloned = {
    ...(parsedQuery || {}),
    filters: {
      ...(isPlainObject(parsedQuery?.filters) ? parsedQuery.filters : {}),
    },
  };

  if (parsedQuery?.placementDomain) {
    cloned.placementDomain = parsedQuery.placementDomain;
  }

  return cloned;
};

const buildScopeKey = (scope = {}) =>
  [
    scope.role || "unknown",
    scope.userId || "anonymous",
    scope.studentId || "",
    scope.facultyId || "",
    scope.departmentId || "",
  ]
    .filter(Boolean)
    .join(":");

const buildRolePromptContext = (scope = {}) => {
  if (scope.role === "student") {
    return "You are assisting a student and may only use that student's own records plus safe public non-personal information.";
  }

  if (scope.role === "hod") {
    return `You are assisting a Head of Department and must stay within the ${scope.departmentCode || "assigned"} department scope.`;
  }

  if (scope.role === "faculty") {
    return "You are assisting a faculty member and may only use their faculty workspace data, assigned subjects, and reachable student cohort.";
  }

  return "You are assisting an authenticated institutional user with full authorized access.";
};

const buildAccessDeniedMessage = (scope = {}, reason = "out_of_scope") => {
  if (scope.role === "student") {
    if (reason === "other_student") {
      return "You can only access your own student records.";
    }

    return "Student access is limited to your own academic records and safe public information.";
  }

  if (scope.role === "hod") {
    return "HOD access is restricted to your department.";
  }

  if (scope.role === "faculty") {
    return "Faculty access is limited to your assigned workspace data.";
  }

  return "You do not have permission to access that chatbot data scope.";
};

const buildAccessDeniedDecision = (scope = {}, reason = "out_of_scope", extra = {}) => ({
  accessDenied: true,
  reason,
  message: buildAccessDeniedMessage(scope, reason),
  audit: {
    role: scope.role || null,
    scopeKey: scope.scopeKey || null,
    denied: true,
    reason,
    ...extra,
  },
});

const buildCustomAccessDeniedDecision = (
  scope = {},
  message = "You do not have permission to access that chatbot data scope.",
  reason = "out_of_scope",
  extra = {}
) => ({
  accessDenied: true,
  reason,
  message,
  audit: {
    role: scope.role || null,
    scopeKey: scope.scopeKey || null,
    denied: true,
    reason,
    ...extra,
  },
});

const collectRequestedDepartmentCodes = async (message = "", parsedQuery = null) => {
  const codes = new Set();
  const departments = await resolveMentionedDepartments(message);
  departments.forEach((department) => {
    const code = normalizeDepartmentCode(department?.code);
    if (code) {
      codes.add(code);
    }
  });

  const filters = parsedQuery?.filters || {};
  const values = [
    filters.department,
    filters.departmentCode,
    filters["department.code"],
  ];

  values.forEach((value) => {
    if (typeof value === "string") {
      const code = normalizeDepartmentCode(value);
      if (code) {
        codes.add(code);
      }
      return;
    }

    if (isPlainObject(value) && typeof value.$eq === "string") {
      const code = normalizeDepartmentCode(value.$eq);
      if (code) {
        codes.add(code);
      }
    }
  });

  return [...codes];
};

const collectRequestedRollNumbers = (message = "", parsedQuery = null) => {
  const rolls = new Set();
  for (const match of String(message || "").matchAll(ROLL_NUMBER_PATTERN)) {
    if (match[1]) {
      rolls.add(match[1].toUpperCase());
    }
  }

  const filters = parsedQuery?.filters || {};
  const values = [filters.rollNumber, filters.roll_number];
  values.forEach((value) => {
    if (typeof value === "string") {
      rolls.add(value.toUpperCase());
      return;
    }

    if (isPlainObject(value) && typeof value.$eq === "string") {
      rolls.add(value.$eq.toUpperCase());
    }
  });

  return [...rolls];
};

const collectRequestedEmails = (message = "", parsedQuery = null) => {
  const emails = new Set(
    [...String(message || "").matchAll(EMAIL_PATTERN)].map((match) =>
      String(match[0] || "").toLowerCase()
    )
  );
  const filters = parsedQuery?.filters || {};
  const values = [filters.email];
  values.forEach((value) => {
    if (typeof value === "string") {
      emails.add(value.toLowerCase());
      return;
    }

    if (isPlainObject(value) && typeof value.$eq === "string") {
      emails.add(value.$eq.toLowerCase());
    }
  });

  return [...emails];
};

const hasBroadScopeRequest = (message = "") =>
  BROAD_SCOPE_PATTERN.test(String(message || ""));

const hasReportRequest = (message = "") =>
  REPORT_SCOPE_PATTERN.test(String(message || ""));

const hasSelfReference = (message = "") =>
  SELF_REFERENCE_PATTERN.test(String(message || ""));

const getRequestedEntity = ({ entity = null, parsedQuery = null } = {}) =>
  normalizeEntityKey(entity || parsedQuery?.entity || null);

const mergeScopedFilters = (parsedQuery = null, scopedFilters = {}) => {
  const nextParsedQuery = cloneParsedQuery(parsedQuery);
  nextParsedQuery.filters = {
    ...nextParsedQuery.filters,
    ...scopedFilters,
  };
  return nextParsedQuery;
};

const resolveStudentProfile = async (user) => {
  let student = await Student.findOne({ user: user._id })
    .populate("department", "name code")
    .lean();

  if (!student && user.email) {
    student = await Student.findOne({ email: user.email.toLowerCase() })
      .populate("department", "name code")
      .lean();
  }

  return student;
};

const resolveFacultyProfile = async (user) => {
  let faculty = await Faculty.findOne({ user: user._id })
    .populate("department", "name code")
    .lean();

  if (!faculty && user.email) {
    faculty = await Faculty.findOne({ email: user.email.toLowerCase() })
      .populate("department", "name code")
      .lean();
  }

  return faculty;
};

const resolveFacultyWorkspaceScope = async (facultyId = null) => {
  if (!facultyId) {
    return {
      subjectIds: [],
      accessibleStudentIds: [],
    };
  }

  const subjectIds = await Subject.find({ faculty: facultyId }).distinct("_id");
  if (!subjectIds.length) {
    return {
      subjectIds: [],
      accessibleStudentIds: [],
    };
  }

  const [markStudentIds, attendanceStudentIds] = await Promise.all([
    Marks.find({ subject: { $in: subjectIds } }).distinct("student"),
    Attendance.find({ subject: { $in: subjectIds } }).distinct("student"),
  ]);

  return {
    subjectIds: uniqIds([...subjectIds]),
    accessibleStudentIds: uniqIds([...markStudentIds, ...attendanceStudentIds]),
  };
};

const resolveChatbotAccessScope = async (user = null) => {
  if (!user?._id) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const role = String(user.role || "").trim().toLowerCase();
  const baseScope = {
    role,
    userId: toIdString(user._id || user.id),
    userEmail: String(user.email || "").toLowerCase() || null,
    departmentId: toIdString(user.department?._id || user.department),
    departmentCode: normalizeDepartmentCode(user.department?.code || null),
    department: user.department?._id
      ? {
          _id: toIdString(user.department._id),
          name: user.department.name || null,
          code: normalizeDepartmentCode(user.department.code || null),
        }
      : null,
    studentId: null,
    studentRollNumber: null,
    facultyId: null,
    subjectIds: [],
    accessibleStudentIds: [],
    canUseInstitutionAnalytics: FULL_ACCESS_ROLES.has(role),
    canUseDepartmentAnalytics: FULL_ACCESS_ROLES.has(role) || role === "hod",
    canUsePublicPlacementInfo: role === "student",
  };

  if (FULL_ACCESS_ROLES.has(role)) {
    const scope = {
      ...baseScope,
    };
    return {
      ...scope,
      scopeKey: buildScopeKey(scope),
      rolePromptContext: buildRolePromptContext(scope),
    };
  }

  if (role === "student") {
    const student = await resolveStudentProfile(user);
    if (!student?._id) {
      const error = new Error("Student profile not found for the authenticated account.");
      error.statusCode = 403;
      throw error;
    }

    const scope = {
      ...baseScope,
      departmentId: toIdString(student.department?._id || baseScope.departmentId),
      departmentCode:
        normalizeDepartmentCode(student.department?.code || null) ||
        baseScope.departmentCode,
      department: student.department?._id
        ? {
            _id: toIdString(student.department._id),
            name: student.department.name || null,
            code: normalizeDepartmentCode(student.department.code || null),
          }
        : baseScope.department,
      studentId: toIdString(student._id),
      studentRollNumber: student.rollNumber || null,
      studentProfile: student,
    };

    return {
      ...scope,
      scopeKey: buildScopeKey(scope),
      rolePromptContext: buildRolePromptContext(scope),
    };
  }

  if (role === "faculty" || role === "hod") {
    const faculty = await resolveFacultyProfile(user);
    if (!faculty?._id) {
      console.warn("Chatbot scope warning:", {
        role,
        userId: toIdString(user._id || user.id),
        departmentId: toIdString(user.department?._id || user.department),
        reason: "faculty_profile_missing",
      });

      const scope = {
        ...baseScope,
        profileResolutionWarning: "Faculty profile not found for the authenticated account.",
      };

      return {
        ...scope,
        scopeKey: buildScopeKey(scope),
        rolePromptContext: buildRolePromptContext(scope),
      };
    }

    const workspaceScope = await resolveFacultyWorkspaceScope(faculty._id);
    const scope = {
      ...baseScope,
      departmentId: toIdString(faculty.department?._id || baseScope.departmentId),
      departmentCode:
        normalizeDepartmentCode(faculty.department?.code || null) ||
        baseScope.departmentCode,
      department: faculty.department?._id
        ? {
            _id: toIdString(faculty.department._id),
            name: faculty.department.name || null,
            code: normalizeDepartmentCode(faculty.department.code || null),
          }
        : baseScope.department,
      facultyId: toIdString(faculty._id),
      facultyProfile: faculty,
      subjectIds: workspaceScope.subjectIds,
      accessibleStudentIds: workspaceScope.accessibleStudentIds,
    };

    return {
      ...scope,
      scopeKey: buildScopeKey(scope),
      rolePromptContext: buildRolePromptContext(scope),
    };
  }

  const scope = {
    ...baseScope,
  };
  return {
    ...scope,
    scopeKey: buildScopeKey(scope),
    rolePromptContext: buildRolePromptContext(scope),
  };
};

const validateStudentScope = async ({
  message = "",
  parsedQuery = null,
  accessScope = {},
  entity = null,
  intent = null,
} = {}) => {
  const requestedDepartments = await collectRequestedDepartmentCodes(message, parsedQuery);
  if (requestedDepartments.length) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
      requestedDepartments,
    });
  }

  const requestedRollNumbers = collectRequestedRollNumbers(message, parsedQuery);
  if (
    requestedRollNumbers.length &&
    requestedRollNumbers.some(
      (rollNumber) => rollNumber !== String(accessScope.studentRollNumber || "").toUpperCase()
    )
  ) {
    return buildAccessDeniedDecision(accessScope, "other_student", {
      entity,
      intent,
      requestedRollNumbers,
    });
  }

  const requestedEmails = collectRequestedEmails(message, parsedQuery);
  if (
    requestedEmails.length &&
    requestedEmails.some(
      (email) => email !== String(accessScope.userEmail || "").toLowerCase()
    )
  ) {
    return buildAccessDeniedDecision(accessScope, "other_student", {
      entity,
      intent,
      requestedEmails,
    });
  }

  const placementDomain =
    entity === "placement"
      ? detectPlacementDomain(message, parsedQuery)
      : null;

  if (entity === "placement") {
    let scopedParsedQuery = cloneParsedQuery(parsedQuery);
    const ownDepartment = normalizeDepartmentCode(accessScope.departmentCode);

    if (
      requestedDepartments.length &&
      requestedDepartments.some((code) => code !== ownDepartment)
    ) {
      return buildAccessDeniedDecision(accessScope, "out_of_scope", {
        entity,
        intent,
        requestedDepartments,
      });
    }

    if (placementDomain === "placement_application") {
      scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
        student: toObjectId(accessScope.studentId),
      });

      return {
        accessDenied: false,
        parsedQuery: {
          ...scopedParsedQuery,
          placementDomain,
        },
        audit: {
          role: accessScope.role,
          scopeKey: accessScope.scopeKey,
          denied: false,
          entity,
          intent,
          injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
        },
      };
    }

    if (placementDomain === "placement_drive") {
      scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
        department: ownDepartment,
      });

      return {
        accessDenied: false,
        parsedQuery: {
          ...scopedParsedQuery,
          placementDomain,
        },
        audit: {
          role: accessScope.role,
          scopeKey: accessScope.scopeKey,
          denied: false,
          entity,
          intent,
          injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
        },
      };
    }

    if (hasSelfReference(message)) {
      scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
        student: toObjectId(accessScope.studentId),
      });

      return {
        accessDenied: false,
        parsedQuery: {
          ...scopedParsedQuery,
          placementDomain,
        },
        audit: {
          role: accessScope.role,
          scopeKey: accessScope.scopeKey,
          denied: false,
          entity,
          intent,
          injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
        },
      };
    }

    if (
      /\b(recruiter|recruiters|trend|distribution|package distribution|placement percentage|placement rate|readiness|summary|overview|highest package|average package)\b/i.test(
        String(message || "")
      )
    ) {
      scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
        department: ownDepartment,
      });

      return {
        accessDenied: false,
        parsedQuery: {
          ...scopedParsedQuery,
          placementDomain,
        },
        audit: {
          role: accessScope.role,
          scopeKey: accessScope.scopeKey,
          denied: false,
          entity,
          intent,
          injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
        },
      };
    }

    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
      placementDomain,
    });
  }

  if (
    !STUDENT_OWNED_ENTITIES.has(entity) &&
    !STUDENT_PUBLIC_ENTITIES.has(entity) &&
    entity
  ) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
    });
  }

  if (
    hasBroadScopeRequest(message) &&
    !hasSelfReference(message) &&
    entity !== "event"
  ) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
    });
  }

  let scopedParsedQuery = cloneParsedQuery(parsedQuery);
  if (!entity) {
    return {
      accessDenied: false,
      parsedQuery: scopedParsedQuery,
      audit: {
        role: accessScope.role,
        scopeKey: accessScope.scopeKey,
        denied: false,
        entity,
        intent,
      },
    };
  }

  if (entity === "student") {
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      _id: toObjectId(accessScope.studentId),
    });
  }

  if (["attendance", "mark", "placement", "document", "participation"].includes(entity)) {
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      student: toObjectId(accessScope.studentId),
    });
  }

  return {
    accessDenied: false,
    parsedQuery: scopedParsedQuery,
    audit: {
      role: accessScope.role,
      scopeKey: accessScope.scopeKey,
      denied: false,
      entity,
      intent,
      injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
    },
  };
};

const validateHodScope = async ({
  message = "",
  parsedQuery = null,
  accessScope = {},
  entity = null,
  intent = null,
} = {}) => {
  const requestedDepartments = await collectRequestedDepartmentCodes(message, parsedQuery);
  const ownDepartment = normalizeDepartmentCode(accessScope.departmentCode);

  if (
    requestedDepartments.length &&
    requestedDepartments.some((code) => code !== ownDepartment)
  ) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
      requestedDepartments,
      ownDepartment,
    });
  }

  if (entity === "naac" || entity === "user") {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
    });
  }

  if (
    entity === "department" &&
    /compare|comparison/i.test(String(message || ""))
  ) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
    });
  }

  let scopedParsedQuery = cloneParsedQuery(parsedQuery);
  if (HOD_SCOPED_ENTITIES.has(entity)) {
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      department: ownDepartment,
    });
  }

  return {
    accessDenied: false,
    parsedQuery: scopedParsedQuery,
    audit: {
      role: accessScope.role,
      scopeKey: accessScope.scopeKey,
      denied: false,
      entity,
      intent,
      injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
    },
  };
};

const validateFacultyScope = async ({
  message = "",
  parsedQuery = null,
  accessScope = {},
  entity = null,
  intent = null,
} = {}) => {
  const requestedDepartments = await collectRequestedDepartmentCodes(message, parsedQuery);
  const ownDepartment = normalizeDepartmentCode(accessScope.departmentCode);

  if (
    requestedDepartments.length &&
    requestedDepartments.some((code) => code !== ownDepartment)
  ) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
      requestedDepartments,
      ownDepartment,
    });
  }

  if (
    !FACULTY_SELF_ENTITIES.has(entity) &&
    entity !== null
  ) {
    return buildAccessDeniedDecision(accessScope, "out_of_scope", {
      entity,
      intent,
    });
  }

  let scopedParsedQuery = cloneParsedQuery(parsedQuery);

  if (!accessScope.facultyId && entity && entity !== "document") {
    return buildCustomAccessDeniedDecision(
      accessScope,
      "Faculty profile not found for the authenticated account. Please contact the administrator to link your faculty record.",
      "profile_missing",
      {
        entity,
        intent,
      }
    );
  }

  if (entity === "faculty") {
    if (
      (hasBroadScopeRequest(message) || hasReportRequest(message)) &&
      !hasSelfReference(message)
    ) {
      return buildAccessDeniedDecision(accessScope, "out_of_scope", {
        entity,
        intent,
      });
    }

    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      _id: toObjectId(accessScope.facultyId),
    });
  }

  if (entity === "subject") {
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      faculty: toObjectId(accessScope.facultyId),
    });
  }

  if (entity === "student") {
    const studentIds = toObjectIdList(accessScope.accessibleStudentIds);
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      _id: studentIds.length ? { $in: studentIds } : null,
    });
  }

  if (entity === "attendance" || entity === "mark") {
    const subjectIds = toObjectIdList(accessScope.subjectIds);
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      subject: subjectIds.length ? { $in: subjectIds } : null,
    });
  }

  if (entity === "research" || entity === "achievement") {
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      faculty: toObjectId(accessScope.facultyId),
    });
  }

  if (entity === "document") {
    scopedParsedQuery = mergeScopedFilters(scopedParsedQuery, {
      uploadedBy: toObjectId(accessScope.userId),
    });
  }

  return {
    accessDenied: false,
    parsedQuery: scopedParsedQuery,
    audit: {
      role: accessScope.role,
      scopeKey: accessScope.scopeKey,
      denied: false,
      entity,
      intent,
      injectedFilters: Object.keys(scopedParsedQuery.filters || {}),
    },
  };
};

const validateAndApplyRoleScope = async ({
  message = "",
  parsedQuery = null,
  entity = null,
  intent = null,
  accessScope = null,
} = {}) => {
  if (!accessScope?.role || FULL_ACCESS_ROLES.has(accessScope.role)) {
    return {
      accessDenied: false,
      parsedQuery: cloneParsedQuery(parsedQuery),
      audit: {
        role: accessScope?.role || null,
        scopeKey: accessScope?.scopeKey || null,
        denied: false,
        entity,
        intent,
      },
    };
  }

  const normalizedEntity = getRequestedEntity({ entity, parsedQuery });
  const normalizedIntent = intent || parsedQuery?.intent || null;

  if (accessScope.role === "student") {
    return validateStudentScope({
      message,
      parsedQuery,
      accessScope,
      entity: normalizedEntity,
      intent: normalizedIntent,
    });
  }

  if (accessScope.role === "hod") {
    return validateHodScope({
      message,
      parsedQuery,
      accessScope,
      entity: normalizedEntity,
      intent: normalizedIntent,
    });
  }

  if (accessScope.role === "faculty") {
    return validateFacultyScope({
      message,
      parsedQuery,
      accessScope,
      entity: normalizedEntity,
      intent: normalizedIntent,
    });
  }

  return {
    accessDenied: false,
    parsedQuery: cloneParsedQuery(parsedQuery),
    audit: {
      role: accessScope.role,
      scopeKey: accessScope.scopeKey,
      denied: false,
      entity: normalizedEntity,
      intent: normalizedIntent,
    },
  };
};

const normalizeKnowledgeCollection = (collection = "") => {
  const normalized = String(collection || "").trim().toLowerCase();

  if (normalized === "students") return "student";
  if (normalized === "faculties") return "faculty";
  if (normalized === "subjects") return "subject";
  if (normalized === "placements") return "placement";
  if (normalized === "attendances") return "attendance";
  if (normalized === "marks") return "mark";
  if (normalized === "documents") return "document";
  if (normalized === "departments") return "department";
  if (normalized === "users") return "user";
  if (normalized === "researchpapers") {
    return "research";
  }

  if (normalized === "facultyachievements") {
    return "achievement";
  }

  if (normalized === "naaccriterias") {
    return "naac";
  }

  if (normalized === "nbacriterias") {
    return "nba";
  }

  return normalizeEntityKey(
    normalized
      .replace(/criterias$/i, "criteria")
      .replace(/s$/i, "")
  );
};

const applyRoleScopeToKnowledgePlan = async ({
  plan = null,
  message = "",
  accessScope = null,
} = {}) => {
  if (!plan?.queries?.length || !accessScope?.role || FULL_ACCESS_ROLES.has(accessScope.role)) {
    return {
      accessDenied: false,
      plan,
    };
  }

  const scopedQueries = [];
  for (const query of plan.queries) {
    const collection = String(query.collection || "");
    const entity = normalizeKnowledgeCollection(collection);
    const denial = await validateAndApplyRoleScope({
      message,
      parsedQuery: {
        entity,
        filters: {},
      },
      entity,
      intent: query.operation === "count" ? "count" : "data",
      accessScope,
    });

    if (denial.accessDenied) {
      return denial;
    }

    const scopedFilters = [];
    if (accessScope.role === "student") {
      if (collection === "students") {
        scopedFilters.push({
          field: "rollNumber",
          operator: "eq",
          value: accessScope.studentRollNumber,
        });
      } else if (["placements", "attendances", "marks", "documents"].includes(collection)) {
        scopedFilters.push({
          field: "studentRollNumber",
          operator: "eq",
          value: accessScope.studentRollNumber,
        });
      }
    }

    if (accessScope.role === "hod") {
      if (
        [
          "students",
          "faculties",
          "subjects",
          "researchpapers",
          "facultyachievements",
          "documents",
          "placements",
          "attendances",
          "marks",
          "nbacriterias",
        ].includes(collection)
      ) {
        scopedFilters.push({
          field: "departmentCode",
          operator: "eq",
          value: accessScope.departmentCode,
        });
      } else if (collection === "departments") {
        scopedFilters.push({
          field: "code",
          operator: "eq",
          value: accessScope.departmentCode,
        });
      }
    }

    if (accessScope.role === "faculty") {
      if (collection === "faculties") {
        scopedFilters.push({
          field: "email",
          operator: "eq",
          value: accessScope.userEmail,
        });
      } else if (collection === "subjects") {
        scopedFilters.push({
          field: "faculty",
          operator: "eq",
          value: toObjectId(accessScope.facultyId),
        });
      } else if (["researchpapers", "facultyachievements"].includes(collection)) {
        scopedFilters.push({
          field: "faculty",
          operator: "eq",
          value: toObjectId(accessScope.facultyId),
        });
      } else if (collection === "documents") {
        scopedFilters.push({
          field: "uploadedBy",
          operator: "eq",
          value: toObjectId(accessScope.userId),
        });
      } else if (["marks", "attendances"].includes(collection)) {
        const subjectIds = toObjectIdList(accessScope.subjectIds);
        scopedFilters.push({
          field: "subject",
          operator: "in",
          value: subjectIds,
        });
      } else {
        return buildAccessDeniedDecision(accessScope, "out_of_scope", {
          entity,
          collection,
        });
      }
    }

    scopedQueries.push({
      ...query,
      filters: [...(Array.isArray(query.filters) ? query.filters : []), ...scopedFilters],
    });
  }

  return {
    accessDenied: false,
    plan: {
      ...plan,
      queries: scopedQueries,
    },
  };
};

const scopeMatchesMetadata = (metadata = null, accessScope = null) =>
  Boolean(metadata?.accessScopeKey) &&
  Boolean(accessScope?.scopeKey) &&
  String(metadata.accessScopeKey) === String(accessScope.scopeKey);

const decoratePayloadWithAccessScope = (payload = null, accessScope = null) => {
  if (!payload || typeof payload !== "object" || !accessScope?.scopeKey) {
    return payload;
  }

  const decorated = {
    ...payload,
    meta: {
      ...(payload.meta || {}),
      accessScopeKey: accessScope.scopeKey,
      accessRole: accessScope.role,
    },
  };

  if (isPlainObject(payload.insights)) {
    decorated.insights = {
      ...payload.insights,
      meta: {
        ...(payload.insights.meta || {}),
        accessScopeKey: accessScope.scopeKey,
        accessRole: accessScope.role,
      },
    };
  }

  return decorated;
};

module.exports = {
  buildAccessDeniedDecision,
  buildAccessDeniedMessage,
  decoratePayloadWithAccessScope,
  resolveChatbotAccessScope,
  scopeMatchesMetadata,
  validateAndApplyRoleScope,
  applyRoleScopeToKnowledgePlan,
};
