import { Request, Response } from "express";
import { BadgeService } from "../services/badge.service";
import { User } from "../db_schema";

class BadgeController {
  private readonly badgeService: BadgeService;

  constructor() {
    this.badgeService = new BadgeService();
  }

  public async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const user_id = (req as any).user.id
      const response = await this.badgeService.getAllBadges(user_id);
      return res.status(200).json(response);
    }
    catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default BadgeController;
