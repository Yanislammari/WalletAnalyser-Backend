import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthResponseDto, FirstFaDto, LoginRequestAdmin2FaDto, LoginRequestDto, RegisterRequestDto } from "../dtos";

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
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({ message: "Email already exists" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async login2FaAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const request: LoginRequestAdmin2FaDto = req.body;
      const response: AuthResponseDto = await this.authService.login2FaAdmin(request.code, request.token);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "TIME_EXPIRE") {
        return res.status(401).json({ message: "The code has expired, you need to login again" });
      }
      else if (error instanceof Error && error.message === "WRONG_CODE") {
        return res.status(401).json({ message: "The code is wrong" });
      } else if (error instanceof Error && error.message === "jwt expired") {
        return res.status(401).json({ message: "The code has expired, you need to login again" });
      }
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async resendCode2FaAdmin(req: Request, res: Response): Promise<Response> {
    try {
      if(req.body.token == ""){
        throw Error("TIME_EXPIRE")
      }
      const response: FirstFaDto = await this.authService.resendCode2FaAdmin(req.body.token);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "TIME_EXPIRE") {
        return res.status(401).json({ message: "The code has expired, you need to login again" });
      } else if (error instanceof Error && error.message === "jwt expired") {
        return res.status(401).json({ message: "The code has expired, you need to login again" });
      }
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async loginAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const request: LoginRequestDto = req.body;
      const response: FirstFaDto = await this.authService.loginAdmin(request);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_EMAIL_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid email credentials" });
      } else if (error instanceof Error && error.message === "PASSWORD_NOT_SET") {
        return res.status(401).json({ message: "Password not set for this user" });
      } else if (error instanceof Error && error.message === "INVALID_PASSWORD_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid password credentials" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async login(req: Request, res: Response): Promise<Response> {
    try {
      const request: LoginRequestDto = req.body;
      const response: AuthResponseDto = await this.authService.login(request);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_EMAIL_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid email credentials" });
      } else if (error instanceof Error && error.message === "PASSWORD_NOT_SET") {
        return res.status(401).json({ message: "Password not set for this user" });
      } else if (error instanceof Error && error.message === "INVALID_PASSWORD_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid password credentials" });
      } else if (error instanceof Error && error.message === "USER_BANNED") {
        return res.status(401).json({ message: "Your account has been banned. Please contact support for more information." });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async authWithGoogle(req: Request, res: Response): Promise<Response> {
    try {
      const idToken = req.body.token;
      const response: AuthResponseDto = await this.authService.authWithGoogle(idToken);
      return res.status(200).json(response);
    } catch (error) {
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
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async sendResetPasswordEmail(req: Request, res: Response): Promise<Response> {
    try {
      const email: string = req.body.email;
      await this.authService.sendResetPasswordEmail(email);
      return res.status(200).json({ message: "Reset password email sent" });
    } catch (error) {
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
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_TOKEN") {
        return res.status(400).json({ message: "Invalid token" });
      } else if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
        return res.status(400).json({ message: "Token expired" });
      }
      return res.status(500).json({ message: "Failed to reset password" });
    }
  }

  public async changePasswordAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const newPassword: string = req.body.newPassword;
      const password : string = req.body.password;
      await this.authService.changePassword(password, newPassword, (req as any).user.id);
      return res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
      if (error instanceof Error && error.message === "RESET_PASSWORD_FAILED") {
        return res.status(500).json({ message: "An error occured, please try later" });
      }
      return res.status(500).json({ message: "Failed to reset password" });
    }
  }

  public async verifyToken(req: Request, res: Response): Promise<Response> {
    try {
      const token: string = req.body.token;
      const user = await this.authService.verifyToken(token);
      return res.status(200).json({ user });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_TOKEN") {
        return res.status(400).json({ message: "Invalid token" });
      } else if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
        return res.status(400).json({ message: "Token expired" });
      }
      return res.status(500).json({ message: "Failed to verify token" });
    }
  }

  public async verifyTokenAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const token: string = req.body.token;
      const user = await this.authService.verifyTokenAdmin(token);
      return res.status(200).json( user );
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_TOKEN") {
        return res.status(400).json({ message: "Invalid token" });
      } else if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
        return res.status(400).json({ message: "Token expired" });
      }
      return res.status(500).json({ message: "Failed to verify token" });
    }
  }
}

export default AuthController;
