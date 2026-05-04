import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodType } from "zod";

export const ValidatorMiddleware = (schema: ZodObject<Record<string, ZodType>>) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    console.log(result.error.flatten())
    return res.status(400).json({
      message: "Validation error",
      errors: result.error.flatten(),
    });
  }

  req.body = result.data;
  next();
};
