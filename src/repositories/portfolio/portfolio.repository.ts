import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { BaseRepository } from "../base.repository";

export class PortfolioRepository extends BaseRepository<Portfolio> {
  constructor() {
    super(Portfolio);
  }

  public async getByUserId(userId: string, page: number, limit: number): Promise<{ rows: Portfolio[]; count: number }> {
    return this.model.findAndCountAll({
      where: { user_uuid: userId },
      limit,
      offset: (page - 1) * limit,
      order: [["created_at", "ASC"]],
    });
  }
}
