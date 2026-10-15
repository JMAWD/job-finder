// Makes beta access codes. Give one code to each tester; paste the ACCESS_CODES line into the function's secret variables.
//   node make-codes.mjs 20
import crypto from "node:crypto";
const n = Math.min(500, Math.max(1, +process.argv[2] || 10));
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O or 1/I mix-ups
const codes = Array.from({ length: n }, () => {
  const bytes = crypto.randomBytes(10);
  const s = [...bytes].map(b => alphabet[b % alphabet.length]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
});
const hashes = codes.map(c => crypto.createHash("sha256").update(c, "utf8").digest("hex"));
console.log("Codes to hand out (keep this list private):\n" + codes.join("\n"));
console.log("\nACCESS_CODES secret value:\n" + hashes.join(","));
