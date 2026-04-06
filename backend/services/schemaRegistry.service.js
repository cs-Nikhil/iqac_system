const Student = require("../models/Student");
const Department = require("../models/Department");
const Faculty = require("../models/Faculty");
const Placement = require("../models/Placement");
const ResearchPaper = require("../models/ResearchPaper");
const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const FacultyAchievement = require("../models/FacultyAchievement");
const Document = require("../models/Document");
const NAACCriteria = require("../models/NAACCriteria");
const NBACriteria = require("../models/NBACriteria");
const { Event, Participation } = require("../models/Event");
const Subject = require("../models/Subject");
const User = require("../models/User");

const MODEL_CONFIG = [
  { collection: "attendances", model: Attendance, aliases: ["attendance", "attendances"] },
  { collection: "departments", model: Department, aliases: ["department", "departments"] },
  { collection: "documents", model: Document, aliases: ["document", "documents", "files", "evidence"] },
  { collection: "events", model: Event, aliases: ["event", "events"] },
  { collection: "faculties", model: Faculty, aliases: ["faculty", "faculties", "teachers", "professors", "lecturers"] },
  { collection: "facultyachievements", model: FacultyAchievement, aliases: ["faculty achievement", "faculty achievements", "achievement", "achievements"] },
  { collection: "marks", model: Marks, aliases: ["mark", "marks", "result", "results", "grade", "grades"] },
  { collection: "naaccriterias", model: NAACCriteria, aliases: ["naac", "naac criteria", "naaccriterias"] },
  { collection: "nbacriterias", model: NBACriteria, aliases: ["nba", "nba criteria", "nbacriterias"] },
  { collection: "participations", model: Participation, aliases: ["participation", "participations"] },
  { collection: "placements", model: Placement, aliases: ["placement", "placements", "company", "companies"] },
  { collection: "researchpapers", model: ResearchPaper, aliases: ["research", "paper", "papers", "researchpapers", "publication", "publications"] },
  { collection: "students", model: Student, aliases: ["student", "students"] },
  { collection: "subjects", model: Subject, aliases: ["subject", "subjects"] },
  { collection: "users", model: User, aliases: ["user", "users", "admin", "admins"] },
];

const normalizeAlias = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const summarizeSchemaPath = (pathName, schemaType) => ({
  path: pathName,
  instance: schemaType.instance || "Mixed",
  ref: schemaType.options?.ref || null,
  isArray: schemaType.instance === "Array",
});

const buildSchemaRegistry = () =>
  MODEL_CONFIG.reduce((accumulator, entry) => {
    const paths = Object.entries(entry.model.schema.paths)
      .filter(([pathName]) => pathName !== "__v")
      .map(([pathName, schemaType]) => summarizeSchemaPath(pathName, schemaType));

    accumulator[entry.collection] = {
      collection: entry.collection,
      model: entry.model,
      aliases: entry.aliases,
      paths,
      searchablePaths: paths
        .filter((item) => ["String", "Number", "Boolean", "Date", "ObjectId"].includes(item.instance))
        .map((item) => item.path),
      referencePaths: paths
        .filter((item) => item.ref)
        .map((item) => ({
          path: item.path,
          ref: item.ref,
        })),
    };
    return accumulator;
  }, {});

const SCHEMA_REGISTRY = buildSchemaRegistry();

const MODEL_NAME_TO_COLLECTION = Object.values(SCHEMA_REGISTRY).reduce((accumulator, entry) => {
  accumulator[entry.model.modelName] = entry.collection;
  return accumulator;
}, {
  Event: "events",
  Participation: "participations",
});

const COLLECTION_ALIAS_MAP = MODEL_CONFIG.reduce((accumulator, entry) => {
  const normalizedCollection = normalizeAlias(entry.collection);
  accumulator[normalizedCollection] = entry.collection;

  entry.aliases.forEach((alias) => {
    accumulator[normalizeAlias(alias)] = entry.collection;
  });

  return accumulator;
}, {});

const resolveCollectionAlias = (value = "") =>
  COLLECTION_ALIAS_MAP[normalizeAlias(value)] || null;

const getCollectionAliases = (collection = "") => {
  const resolvedCollection = resolveCollectionAlias(collection) || collection;
  return MODEL_CONFIG.find((entry) => entry.collection === resolvedCollection)?.aliases || [];
};

module.exports = {
  SCHEMA_REGISTRY,
  MODEL_NAME_TO_COLLECTION,
  COLLECTION_ALIAS_MAP,
  ALLOWED_COLLECTIONS: MODEL_CONFIG.map((item) => item.collection),
  getCollectionAliases,
  normalizeAlias,
  resolveCollectionAlias,
};
