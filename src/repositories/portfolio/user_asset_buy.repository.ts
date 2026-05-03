import { Op } from "sequelize";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { BaseRepository } from "../base.repository";

export class UserAssetBuyRepository extends BaseRepository<UserAssetBuy> {
  constructor() {
    super(UserAssetBuy);
  }

  public async getByPortfolioId(portfolioId: string, from?: string, to?: string): Promise<UserAssetBuy[]> {
    const where: Record<string, unknown> = { portfolio_uuid: portfolioId };
    if (from || to) {
      const dateRange: Record<symbol, string> = {};
      if (from) dateRange[Op.gte] = from;
      if (to) dateRange[Op.lte] = to;
      where.buy_date = dateRange;
    }
    return this.model.findAll({ where });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }

  public async getDistinctCompanies(portfolioId: string): Promise<string[]> {
    const results = await this.model.findAll({
      attributes: ["company_name"],
      where: { portfolio_uuid: portfolioId, company_name: { [Op.ne]: null } },
      group: ["company_name"],
    });
    return results.map((r) => r.company_name as string);
  }
}
