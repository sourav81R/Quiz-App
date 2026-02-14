import dns from "dns";

const { promises: dnsPromises } = dns;

async function run() {
  try {
    const records = await dnsPromises.resolveSrv("_mongodb._tcp.cluster0.2owaxaf.mongodb.net");
    console.log("FOUND HOSTS:");
    records.forEach(r => {
      console.log(`${r.name}:${r.port}`);
    });
  } catch (e) {
    console.error("DNS failed:", e.message);
  }
}

run();
