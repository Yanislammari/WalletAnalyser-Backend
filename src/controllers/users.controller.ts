import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthResponseDto, RegisterRequestDto } from "../dtos";
import { UserService } from "../services/user.service";

class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public async get_all_users_paginated(req: Request, res: Response): Promise<Response> {
    try {
      const offset = Number(req.query.offset) || 0;
      const response: AuthResponseDto = await this.userService.get_users_pagination(offset);
      return res.status(201).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default UserController;
