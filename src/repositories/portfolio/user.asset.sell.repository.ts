import { Op } from "sequelize";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { BaseRepository } from "../base.repository";

export class UserAssetSellRepository extends BaseRepository<UserAssetSell> {
  constructor() {
    super(UserAssetSell);
  }

  public async getByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string,company?: string): Promise<{ rows: UserAssetSell[]; count: number }> {
    const where: Record<string, unknown> = { portfolio_uuid: portfolioId };

    if (from || to) {
      const dateRange: Record<symbol, string> = {};
      if (from) {
        dateRange[Op.gte] = from;
      }
      if (to) {
        dateRange[Op.lte] = to;
      }

      where.sell_date = dateRange;
    }

    if (company) {
      where.company_name = company;
    }
    
    return this.model.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [["sell_date", "DESC"]],
    });
  }

  public async getAllByPortfolioId(portfolioId: string): Promise<UserAssetSell[]> {
    return this.model.findAll({ where: { portfolio_uuid: portfolioId } });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }

  public async sumSharesByCompanyAndDate(portfolioId: string, companyName: string, upToDate: string): Promise<number> {
    const total = await this.model.sum("asset_sell_share", {
      where: {
        portfolio_uuid: portfolioId,
        company_name: companyName,
        sell_date: { [Op.lte]: upToDate },
        asset_sell_share: { [Op.ne]: null },
      },
    });
    return total || 0;
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
