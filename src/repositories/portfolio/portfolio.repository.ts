import { Op } from "sequelize";
import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { Currency } from "../../db_schema/currencies/currency";
import { BaseRepository } from "../base.repository";

export class PortfolioRepository extends BaseRepository<Portfolio> {
  constructor() {
    super(Portfolio);
  }

  private get currencyInclude() {
    return [{ model: Currency, as: "display_currency" }];
  }

  public async getByUserId(userId: string, page: number, limit: number, search?: string): Promise<{ rows: Portfolio[]; count: number }> {
    const where: Record<string, unknown> = { user_uuid: userId };

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    return this.model.findAndCountAll({
      where,
      include: this.currencyInclude,
      limit,
      offset: (page - 1) * limit,
      order: [["created_at", "ASC"]],
    });
  }

  public async getById(id: string): Promise<Portfolio | null> {
    return this.model.findOne({
      where: { uuid: id },
      include: this.currencyInclude,
    });
  }
}
