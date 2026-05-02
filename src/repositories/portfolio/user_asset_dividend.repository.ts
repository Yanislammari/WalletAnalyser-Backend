import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { BaseRepository } from "../base.repository";

export class UserAssetDividendRepository extends BaseRepository<UserAssetDividend> {
  constructor() {
    super(UserAssetDividend);
  }

  public async getByPortfolioId(portfolioId: string): Promise<UserAssetDividend[]> {
    return this.model.findAll({ where: { portfolio_uuid: portfolioId } });
  }
}
