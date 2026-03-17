import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../database/prisma.js";

export async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true }
  });

  if (!user) {
    throw new Error("Credenciales inválidas");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Credenciales inválidas");
  }

  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role.name,
      email: user.email
    },
    process.env.JWT_SECRET ?? "secret",
    { expiresIn: "12h" }
  );

  return token;
}
