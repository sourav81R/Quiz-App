const dns = require("dns").promises;

async function run() {
  try {
    const records = await dns.resolveSrv("_mongodb._tcp.cluster0.2owaxaf.mongodb.net");
    console.log("FOUND HOSTS:");
    records.forEach(r => {
      console.log(`${r.name}:${r.port}`);
    });
  } catch (e) {
    console.error("DNS failed:", e.message);
  }
}

run();
