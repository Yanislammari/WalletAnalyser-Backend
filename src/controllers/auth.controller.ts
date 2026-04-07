import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthResponseDto, LoginRequestDto, RegisterRequestDto } from "../dtos";

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
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async login(req: Request, res: Response): Promise<Response> {
    try {
      const request: LoginRequestDto = req.body;
      const response: AuthResponseDto = await this.authService.login(request);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "INVALID_EMAIL_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid email credentials" });
      }
      else if (error instanceof Error && error.message === "PASSWORD_NOT_SET") {
        return res.status(401).json({ message: "Password not set for this user" });
      }
      else if (error instanceof Error && error.message === "INVALID_PASSWORD_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid password credentials" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async authWithGoogle(req: Request, res: Response): Promise<Response> {
    try {
      const idToken = req.body.token;
      const response: AuthResponseDto = await this.authService.authWithGoogle(idToken);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "GOOGLE_AUTH_FAILED") {
        return res.status(401).json({ message: "Google authentication failed" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async checkEmailAvailability(req: Request, res: Response): Promise<Response> {
    try {
      const email: string = req.query.email as string;
      const isAvailable: boolean = await this.authService.checkEmailAvailability(email);
      return res.status(200).json({ available: isAvailable });
    }
    catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async sendResetPasswordEmail(req: Request, res: Response): Promise<Response> {
    try {
      const email: string = req.body.email;
      await this.authService.sendResetPasswordEmail(email);
      return res.status(200).json({ message: "Reset password email sent" });
    }
    catch (error) {
      if (error instanceof Error && error.message === "EMAIL_NOT_FOUND") {
        return res.status(404).json({ message: "Email not found" });
      }
      return res.status(500).json({ message: "Failed to send reset password email" });
    }
  }

  public async resetPassword(req: Request, res: Response): Promise<Response> {
    try {
      const token: string = req.body.token;
      const newPassword: string = req.body.newPassword;
      await this.authService.resetPassword(token, newPassword);
      return res.status(200).json({ message: "Password reset successful" });
    }
    catch (error) {
      if (error instanceof Error && error.message === "INVALID_TOKEN") {
        return res.status(400).json({ message: "Invalid token" });
      }
      else if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
        return res.status(400).json({ message: "Token expired" });
      }
      return res.status(500).json({ message: "Failed to reset password" });
    }
  }
}

export default AuthController;
