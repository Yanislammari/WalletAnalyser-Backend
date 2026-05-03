import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { BaseRepository } from "../base.repository";

export class UserAssetBuyRepository extends BaseRepository<UserAssetBuy> {
  constructor() {
    super(UserAssetBuy);
  }

  public async getByPortfolioId(portfolioId: string): Promise<UserAssetBuy[]> {
    return this.model.findAll({ where: { portfolio_uuid: portfolioId } });
  }

  public async countByPortfolioId(portfolioId: string): Promise<number> {
    return this.model.count({ where: { portfolio_uuid: portfolioId } });
  }
}
