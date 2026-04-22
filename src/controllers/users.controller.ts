import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthResponseDto, RegisterRequestDto, UserResponseDto, UsersWithDataResponseDto } from "../dtos";
import { UserService } from "../services/user.service";

class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public async get_all_users_intro(req: Request, res: Response): Promise<Response> {
    try {
      const response: UsersWithDataResponseDto = await this.userService.get_users_intro();
      return res.status(200).json(response);
    } catch (error) {
      /**if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({ message: "Email already exists" });
      }**/
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async get_all_users_offset(req: Request, res: Response): Promise<Response> {
    try {
      const offset = Number(req.query.offset) || 0
      const response: UserResponseDto[] = await this.userService.get_users_offset(offset);
      return res.status(200).json(response);
    } catch (error) {
      /**if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({ message: "Email already exists" });
      }**/
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async ban_user(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.params.userId as string
      const banType = req.body.ban as boolean
      const response: UserResponseDto = await this.userService.ban_user(userId,banType);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_EXISTING") {
        return res.status(409).json({ message: "This user doesnt exist id" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default UserController;
