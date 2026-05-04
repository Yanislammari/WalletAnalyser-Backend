import { Op } from "sequelize";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { BaseRepository } from "../base.repository";

export class UserAssetDividendRepository extends BaseRepository<UserAssetDividend> {
  constructor() {
    super(UserAssetDividend);
  }

  public async getByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string): Promise<{ rows: UserAssetDividend[]; count: number }> {
    const where: Record<string, unknown> = { portfolio_uuid: portfolioId };

    if (from || to) {
      const dateRange: Record<symbol, string> = {};
      if (from) {
        dateRange[Op.gte] = from;
      }
      if (to) {
        dateRange[Op.lte] = to;
      }

      where.cashflow_date = dateRange;
    }
    
    return this.model.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [["cashflow_date", "DESC"]],
    });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }
}
