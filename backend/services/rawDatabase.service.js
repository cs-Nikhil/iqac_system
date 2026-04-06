const mongoose = require("mongoose");
const { SCHEMA_REGISTRY, MODEL_NAME_TO_COLLECTION, ALLOWED_COLLECTIONS } = require("./schemaRegistry.service");

const STOP_WORDS = new Set([
  "a", "an", "and", "all", "about", "are", "as", "at", "by", "can", "data", "details",
  "do", "for", "from", "get", "give", "hello", "help", "hi", "i", "in", "is", "me",
  "my", "of", "on", "please", "records", "show", "tell", "that", "the", "to", "want",
  "what", "with",
]);
const PRIORITY_FIELDS = [
  "name",
  "title",
  "email",
  "rollNumber",
  "code",
  "company",
  "department",
  "phone",
  "status",
  "type",
];

const normalizeToken = (value = "") =>
  value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const singularize = (value = "") =>
  value.endsWith("s") ? value.slice(0, -1) : value;

const extractSearchTokens = (message = "") => {
  const tokens = message.match(/[A-Za-z0-9@._-]+/g) || [];
  return [...new Set(tokens.filter((token) => {
    const normalized = token.toLowerCase();
    return normalized.length >= 3 && !STOP_WORDS.has(normalized);
  }))];
};

const listCollections = async () => {
  const db = mongoose.connection.db;
  if (!db) return [];

  const collections = await db.listCollections().toArray();
  return collections
    .map((item) => item.name)
    .filter((name) => !name.startsWith("system.") && ALLOWED_COLLECTIONS.includes(name));
};

const detectTargetCollections = (message, collections) => {
  const normalizedMessage = normalizeToken(message);

  return collections.filter((collectionName) => {
    const normalizedCollection = normalizeToken(collectionName);
    const aliases = SCHEMA_REGISTRY[collectionName]?.aliases || [];
    return (
      normalizedMessage.includes(normalizedCollection) ||
      normalizedMessage.includes(singularize(normalizedCollection)) ||
      aliases.some((alias) => normalizedMessage.includes(normalizeToken(alias)))
    );
  });
};

const detectCandidateFields = (collectionName, sample = {}) => {
  const schemaKeys = SCHEMA_REGISTRY[collectionName]?.searchablePaths || [];
  const sampleKeys = Object.keys(sample || {});
  const keys = [...new Set([...schemaKeys, ...sampleKeys])];

  return [
    ...PRIORITY_FIELDS.filter((field) => keys.includes(field)),
    ...keys.filter((field) => !PRIORITY_FIELDS.includes(field)),
  ].slice(0, 20);
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQuery = (tokens, fields) => {
  if (!tokens.length || !fields.length) {
    return {};
  }

  return {
    $or: tokens.flatMap((token) =>
      fields.map((field) => ({
        [field]: { $regex: escapeRegex(token), $options: "i" },
      }))
    ),
  };
};

const matchesCollectionOnlyRequest = (message = "", collectionName = "") => {
  const normalizedMessage = normalizeToken(message);
  const normalizedCollection = normalizeToken(collectionName);
  return (
    normalizedMessage === normalizedCollection ||
    normalizedMessage === singularize(normalizedCollection) ||
    normalizedMessage === `show ${normalizedCollection}` ||
    normalizedMessage === `show ${singularize(normalizedCollection)}` ||
    normalizedMessage === `list ${normalizedCollection}` ||
    normalizedMessage === `list ${singularize(normalizedCollection)}`
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
    result[key] = sanitizeDocument(value);
  }
  return result;
};

const isObjectIdLike = (value) =>
  typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

const inferDisplayFields = (collectionName, doc = {}) => {
  const preferred = {
    students: ["name", "rollNumber", "email"],
    departments: ["name", "code"],
    faculties: ["name", "email", "designation"],
    subjects: ["name", "code"],
    users: ["name", "email", "role"],
    placements: ["company", "role", "package", "academicYear"],
    documents: ["title", "category", "type", "status"],
    events: ["title", "type", "level", "location"],
    researchpapers: ["title", "journal", "year"],
    facultyachievements: ["title", "category", "type"],
  };

  const fields = preferred[collectionName] || [];
  const picked = {};
  for (const field of fields) {
    if (doc[field] !== undefined) {
      picked[field] = sanitizeDocument(doc[field]);
    }
  }

  if (Object.keys(picked).length) {
    return picked;
  }

  const fallback = {};
  for (const [key, value] of Object.entries(doc)) {
    if (["_id", "__v", "password"].includes(key)) continue;
    if (value !== null && value !== undefined && typeof value !== "object") {
      fallback[key] = sanitizeDocument(value);
    }
    if (Object.keys(fallback).length >= 4) break;
  }
  return fallback;
};

const resolveReferencePath = async (document, pathSegments, db, targetCollection) => {
  if (!pathSegments.length) {
    return document;
  }

  if (pathSegments.length === 1) {
    const currentValue = document?.[pathSegments[0]];
    if (!isObjectIdLike(currentValue)) {
      return document;
    }

    const targetDoc = await db.collection(targetCollection).findOne({ _id: new mongoose.Types.ObjectId(currentValue) });
    if (!targetDoc) {
      return document;
    }

    return {
      ...document,
      [pathSegments[0]]: inferDisplayFields(targetCollection, sanitizeDocument(targetDoc)),
    };
  }

  const [head, ...tail] = pathSegments;
  const nestedValue = document?.[head];
  if (!nestedValue || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
    return document;
  }

  return {
    ...document,
    [head]: await resolveReferencePath(nestedValue, tail, db, targetCollection),
  };
};

const resolveReferences = async (collectionName, document, db) => {
  const refLookups = SCHEMA_REGISTRY[collectionName]?.referencePaths || [];
  const resolved = { ...document };

  for (const refConfig of refLookups) {
    const targetCollection = MODEL_NAME_TO_COLLECTION[refConfig.ref];
    if (!targetCollection) continue;

    const updated = await resolveReferencePath(resolved, refConfig.path.split("."), db, targetCollection);
    Object.assign(resolved, updated);
  }

  return resolved;
};

const buildSchemaOverview = async (collections, db) => {
  const schema = {};

  for (const collectionName of collections) {
    const sample = await db.collection(collectionName).findOne({});
    if (!sample) {
      schema[collectionName] = [];
      continue;
    }

    schema[collectionName] = SCHEMA_REGISTRY[collectionName]?.paths || detectCandidateFields(collectionName, sample);
  }

  return schema;
};

const executeRawDatabaseQuery = async (message, options = {}) => {
  const db = mongoose.connection.db;
  if (!db) return null;

  const collections = await listCollections();
  const matchedCollections = detectTargetCollections(message, collections);
  const searchTokens = extractSearchTokens(message);
  const collectionsToSearch = matchedCollections.length ? matchedCollections : collections;
  const results = [];
  const emptyCollections = [];

  for (const collectionName of collectionsToSearch) {
    const collection = db.collection(collectionName);
    const sample = await collection.findOne({});
    if (!sample) {
      emptyCollections.push(collectionName);
      continue;
    }

    const fields = detectCandidateFields(collectionName, sample);
    const collectionWords = normalizeToken(collectionName).split(" ").flatMap((word) => [word, singularize(word)]);
    const filteredTokens = searchTokens.filter((token) => !collectionWords.includes(token.toLowerCase()));
    const query = matchesCollectionOnlyRequest(message, collectionName)
      ? {}
      : buildQuery(filteredTokens, fields);
    const limit = options?.limit || (matchesCollectionOnlyRequest(message, collectionName) ? 1000 : 10);
    const documents = await collection.find(query).limit(limit).toArray();

    if (documents.length) {
      const resolvedDocuments = [];
      for (const document of documents.map(sanitizeDocument)) {
        resolvedDocuments.push(await resolveReferences(collectionName, document, db));
      }

      results.push({
        collection: collectionName,
        matchedFields: fields,
        documents: resolvedDocuments,
      });
    }
  }

  return {
    databaseName: db.databaseName,
    collectionsAvailable: collections,
    collectionsSearched: collectionsToSearch,
    schemaOverview: await buildSchemaOverview(collections, db),
    emptyCollections,
    results,
  };
};

module.exports = {
  executeRawDatabaseQuery,
};
