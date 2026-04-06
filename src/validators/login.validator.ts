import { z } from "zod";
import { EMAIL_REGEX, PASSWORD_REGEX } from "../constants/regex";

export const LoginValidator = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email must be a valid email address")
    .max(255, "Email must be at most 255 characters")
    .regex(EMAIL_REGEX, "Email must be a valid email address"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(255, "Password must be at most 255 characters")
    .regex(PASSWORD_REGEX, "Password must be at least 8 characters long and contain at least one letter and one number"),
});

export const LoginSchema = LoginValidator;
