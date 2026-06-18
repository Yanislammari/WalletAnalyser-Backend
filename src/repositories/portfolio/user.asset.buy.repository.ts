import { Op } from "sequelize";
import { attributesUserAssetBuy, UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { AssetPrice } from "../../db_schema/asset/asset_price";
import { Asset } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { AssetType } from "../../dtos";

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
      include: [{ model: AssetPrice, as: "asset_price", include: [{ model: Asset, as: "asset" }] }],
    });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }

  public async getBuysByCompanyAndDate(portfolioId: string, companyName: string, upToDate: string): Promise<UserAssetBuy[]> {
    return this.model.findAll({
      where: {
        portfolio_uuid: portfolioId,
        company_name: companyName,
        buy_date: { [Op.lte]: upToDate },
        asset_buy_share: { [Op.ne]: null },
        asset_buy_price_per_share: { [Op.ne]: null },
      },
      order: [["buy_date", "ASC"]],
    });
  }

  public async sumSharesByCompanyAndDate(portfolioId: string, companyName: string, upToDate: string): Promise<number> {
    const total = await this.model.sum("asset_buy_share", {
      where: {
        portfolio_uuid: portfolioId,
        company_name: companyName,
        buy_date: { [Op.lte]: upToDate },
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

  public async getBuysType(portfolioId : string, type : AssetType): Promise<UserAssetBuy[]> {
    return await this.model.findAll({
      where : { [ attributesUserAssetBuy.portfolio_uuid] : portfolioId},
      include : [{
        model: Asset,
        as: "asset",
      }]
    })
  }
}
