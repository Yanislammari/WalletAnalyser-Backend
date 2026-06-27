import { Op } from "sequelize";
import { attributesUserAssetSell, UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { Asset, attributesAsset } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { AssetType } from "../../dtos";

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

  public async getAllWithAssetByPortfolioId(portfolioId: string): Promise<UserAssetSell[]> {
    return this.model.findAll({
      where: { portfolio_uuid: portfolioId },
      include: [{ model: Asset, as: "asset" }],
    });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }

  public async sumSharesByCompanyAndDate(portfolioId: string, companyName: string, upToDate: string, assetId?: string): Promise<number> {
    const companyFilter = assetId
      ? { [Op.or]: [{ company_name: companyName }, { asset_uuid: assetId, company_name: null }] }
      : { company_name: companyName };
    const total = await this.model.sum("asset_sell_share", {
      where: {
        portfolio_uuid: portfolioId,
        ...companyFilter,
        sell_date: { [Op.lte]: upToDate },
        asset_sell_share: { [Op.ne]: null },
      },
    });
    return total || 0;
  }

  public async sumSharesByCompanyAfterDate(portfolioId: string, companyName: string, afterDate: string, assetId?: string): Promise<number> {
    const companyFilter = assetId
      ? { [Op.or]: [{ company_name: companyName }, { asset_uuid: assetId, company_name: null }] }
      : { company_name: companyName };
    const total = await this.model.sum("asset_sell_share", {
      where: {
        portfolio_uuid: portfolioId,
        ...companyFilter,
        sell_date: { [Op.gt]: afterDate },
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

  public async getSellsType(portfolioId : string, type : AssetType): Promise<UserAssetSell[]> {
    return await this.model.findAll({
      where : { [attributesUserAssetSell.portfolio_uuid] : portfolioId},
      include : [{
        model: Asset,
        as: "asset",
        where : { [attributesAsset.asset_type] : type }
      }]
    })
  }
}
