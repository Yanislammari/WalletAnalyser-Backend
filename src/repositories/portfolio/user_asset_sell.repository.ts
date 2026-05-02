import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { BaseRepository } from "../base.repository";

export class UserAssetSellRepository extends BaseRepository<UserAssetSell> {
  constructor() {
    super(UserAssetSell);
  }

  public async getByPortfolioId(portfolioId: string): Promise<UserAssetSell[]> {
    return this.model.findAll({ where: { portfolio_uuid: portfolioId } });
  }
}
