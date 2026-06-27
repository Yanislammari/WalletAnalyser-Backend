import { Op } from "sequelize";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { Asset } from "../../db_schema";
import { BaseRepository } from "../base.repository";

export class UserAssetBuyRepository extends BaseRepository<UserAssetBuy> {
  constructor() {
    super(UserAssetBuy);
  }

  public async getByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string, company?: string): Promise<{ rows: UserAssetBuy[]; count: number }> {
    const where: Record<string, unknown> = { portfolio_uuid: portfolioId };

    if (from || to) {
      const dateRange: Record<symbol, string> = {};
      if (from) {
        dateRange[Op.gte] = from;
      }
      if (to) {
        dateRange[Op.lte] = to;
      }

      where.buy_date = dateRange;
    }
    
    if (company) {
      where.company_name = company;
    }

    return this.model.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [["buy_date", "DESC"]],
    });
  }

  public async getAllByPortfolioId(portfolioId: string): Promise<UserAssetBuy[]> {
    return this.model.findAll({ where: { portfolio_uuid: portfolioId } });
  }

  public async getAllWithAssetByPortfolioId(portfolioId: string): Promise<UserAssetBuy[]> {
    return this.model.findAll({
      where: { portfolio_uuid: portfolioId },
      include: [{ model: Asset, as: "asset" }],
    });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }

  public async getBuysByCompanyAndDate(portfolioId: string, companyName: string, upToDate: string, assetId?: string): Promise<UserAssetBuy[]> {
    // When assetId is provided, match by either company_name OR asset_uuid so that buys
    // stored with a stale/null company_name are still found via the asset UUID fallback.
    const companyFilter = assetId && companyName
      ? { [Op.or]: [{ company_name: companyName }, { asset_uuid: assetId }] }
      : assetId
        ? { asset_uuid: assetId }
        : { company_name: companyName };
    return this.model.findAll({
      where: {
        portfolio_uuid: portfolioId,
        ...companyFilter,
        buy_date: { [Op.lte]: upToDate },
        asset_buy_share: { [Op.ne]: null },
        asset_buy_price_per_share: { [Op.ne]: null },
      },
      order: [["buy_date", "ASC"]],
    });
  }

  public async sumSharesByCompanyAndDate(portfolioId: string, companyName: string, upToDate: string, assetId?: string): Promise<number> {
    const companyFilter = assetId && companyName
      ? { [Op.or]: [{ company_name: companyName }, { asset_uuid: assetId }] }
      : assetId
        ? { asset_uuid: assetId }
        : { company_name: companyName };
    const total = await this.model.sum("asset_buy_share", {
      where: {
        portfolio_uuid: portfolioId,
        ...companyFilter,
        buy_date: { [Op.lte]: upToDate },
        asset_buy_share: { [Op.ne]: null },
      },
    });
    return total || 0;
  }

  public async sumSharesByCompanyAfterDate(portfolioId: string, companyName: string, afterDate: string, assetId?: string): Promise<number> {
    const companyFilter = assetId && companyName
      ? { [Op.or]: [{ company_name: companyName }, { asset_uuid: assetId }] }
      : assetId
        ? { asset_uuid: assetId }
        : { company_name: companyName };
    const total = await this.model.sum("asset_buy_share", {
      where: {
        portfolio_uuid: portfolioId,
        ...companyFilter,
        buy_date: { [Op.gt]: afterDate },
        asset_buy_share: { [Op.ne]: null },
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
