import { Op } from "sequelize";
import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { BaseRepository } from "../base.repository";

export class PortfolioRepository extends BaseRepository<Portfolio> {
  constructor() {
    super(Portfolio);
  }

  public async getByUserId(userId: string, page: number, limit: number, search?: string): Promise<{ rows: Portfolio[]; count: number }> {
    const where: Record<string, unknown> = { user_uuid: userId };

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }
    
    return this.model.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [["created_at", "ASC"]],
    });
  }
}
