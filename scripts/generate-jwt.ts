import jwt from "jsonwebtoken";

type ApiRole = "read-only" | "analyst" | "admin";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part.startsWith("--")) {
      const key = part.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
      args.set(key, value);
      if (value !== "true") i += 1;
    }
  }
  return args;
}

function isRole(role: string): role is ApiRole {
  return role === "read-only" || role === "analyst" || role === "admin";
}

const args = parseArgs(process.argv.slice(2));
const role = args.get("role") ?? "analyst";
const sub = args.get("sub") ?? "dev-user";
const expiresIn = args.get("expiresIn") ?? "1d";
const secret = process.env.JWT_SECRET ?? "dev-secret";

if (!isRole(role)) {
  console.error(`Invalid role "${role}". Use one of: read-only, analyst, admin.`);
  process.exit(1);
}

const token = jwt.sign({ sub, role }, secret, { expiresIn });
console.log(token);
