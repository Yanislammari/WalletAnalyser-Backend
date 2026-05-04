import { z } from "zod";
import { EMAIL_REGEX } from "../constants/regex";

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
    .min(1, "Password is required")
    .max(255),
});

export const LoginSchema = LoginValidator;
