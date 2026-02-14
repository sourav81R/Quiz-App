function normalizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== "string") {
    return "";
  }

  const uri = rawUri.trim();
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

export { normalizeMongoUri, maskMongoUri, formatMongoError };
