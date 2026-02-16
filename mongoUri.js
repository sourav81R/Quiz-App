function sanitizeEnvValue(rawValue) {
  if (rawValue == null) {
    return "";
  }

  let value = String(rawValue).trim();
  if (!value) {
    return "";
  }

  const hasMatchingDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasMatchingSingleQuotes = value.startsWith("'") && value.endsWith("'");
  if (hasMatchingDoubleQuotes || hasMatchingSingleQuotes) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

function normalizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== "string") {
    return "";
  }

  const uri = sanitizeEnvValue(rawUri);
  if (!uri) {
    return "";
  }

  if (uri.startsWith("mongodb+srv://")) {
    return uri;
  }

  if (!uri.startsWith("mongodb://")) {
    return uri;
  }

  // Keep Atlas shard seed-list URIs in mongodb:// format to avoid SRV DNS lookup.
  if (!uri.includes("-shard-00-")) {
    return uri;
  }

  const match = uri.match(
    /^mongodb:\/\/([^:\/?#]+):([^@\/?#]+)@([^\/?#]+)\/([^?#]+)(?:\?(.+))?$/
  );
  if (!match) {
    return uri;
  }

  const [, username, password, hosts, database, query] = match;
  const params = new URLSearchParams(query || "");
  if (!params.has("retryWrites")) {
    params.set("retryWrites", "true");
  }
  if (!params.has("w")) {
    params.set("w", "majority");
  }
  if (!params.has("tls") && !params.has("ssl")) {
    params.set("tls", "true");
  }
  if (!params.has("authSource")) {
    params.set("authSource", "admin");
  }

  return `mongodb://${username}:${password}@${hosts}/${database}?${params.toString()}`;
}

function resolveMongoUri(env = process.env) {
  let uri = sanitizeEnvValue(
    env.MONGODB_URI_DIRECT ||
      env.MONGODB_URI_NO_SRV ||
      env.MONGODB_URI_NOSRV ||
      env.MONGODB_URI ||
      env.MONGO_URI
  );
  const username = sanitizeEnvValue(
    env.MONGODB_USERNAME || env.MONGO_USERNAME || env.DB_USERNAME
  );
  const password = sanitizeEnvValue(
    env.MONGODB_PASSWORD || env.MONGO_PASSWORD || env.DB_PASSWORD
  );

  if (uri.includes("<db_username>") && username) {
    uri = uri.replaceAll("<db_username>", encodeURIComponent(username));
  }
  if (uri.includes("<db_password>") && password) {
    uri = uri.replaceAll("<db_password>", encodeURIComponent(password));
  }

  // Template placeholders left unresolved -> treat as missing URI
  if (uri.includes("<db_username>") || uri.includes("<db_password>")) {
    return "";
  }

  return normalizeMongoUri(uri);
}

function maskMongoUri(uri) {
  if (!uri) {
    return "(missing MongoDB URI)";
  }

  return uri.replace(/:([^:@/]{1,})@/, ":****@");
}

function formatMongoError(err) {
  if (!err) {
    return "Unknown MongoDB error";
  }

  const details = [];
  if (err.reason && err.reason.servers && typeof err.reason.servers.entries === "function") {
    for (const [host, desc] of err.reason.servers.entries()) {
      if (desc && desc.error && desc.error.message) {
        details.push(`${host} => ${desc.error.message}`);
      } else if (desc && desc.type) {
        details.push(`${host} => ${desc.type}`);
      }
    }
  }

  if (details.length === 0) {
    return err.message || String(err);
  }

  return `${err.message || "MongoDB connection failed"} | ${details.join(" | ")}`;
}

export { sanitizeEnvValue, normalizeMongoUri, resolveMongoUri, maskMongoUri, formatMongoError };
