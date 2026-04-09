import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET ?? "dev-secret";
const expiresIn = process.argv[2] ?? "1d";
const baseSub = process.argv[3] ?? "dev";

const roles = ["read-only", "analyst", "admin"] as const;

for (const role of roles) {
  const sub = `${baseSub}-${role}`;
  const token = jwt.sign({ sub, role }, secret, { expiresIn });
  console.log(`${role}: ${token}`);
}
