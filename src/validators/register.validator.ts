import { z } from "zod";
import { EMAIL_REGEX, PASSWORD_REGEX, SPECIAL_CHARS_REGEX } from "../constants/regex";

export const RegisterValidator = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(100, "First name must be at most 100 characters")
    .regex(SPECIAL_CHARS_REGEX, "First name contains invalid characters"),

  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(100, "Last name must be at most 100 characters")
    .regex(SPECIAL_CHARS_REGEX, "Last name contains invalid characters"),

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

export const RegisterSchema = RegisterValidator;
