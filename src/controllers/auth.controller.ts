import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthResponseDto, RegisterRequestDto } from "../dtos";

class AuthController {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public async register(req: Request, res: Response): Promise<Response> {
    try {
      const request: RegisterRequestDto = req.body;
      const response: AuthResponseDto = await this.authService.register(request);
      return res.status(201).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({ message: "Email already exists" });
      }
      else if (error instanceof Error && error.message === "USERNAME_ALREADY_EXISTS") {
        return res.status(409).json({ message: "Username already exists" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default AuthController;
