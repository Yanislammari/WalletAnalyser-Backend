import { ImportHistory } from "../../db_schema/portfolio/import_history";
import { BaseRepository } from "../base.repository";

export class ImportHistoryRepository extends BaseRepository<ImportHistory> {
  constructor() {
    super(ImportHistory);
  }

  public async getByPortfolioId(portfolioId: string, limit = 20): Promise<ImportHistory[]> {
    return this.model.findAll({
      where: { portfolio_uuid: portfolioId },
      order: [["created_at", "DESC"]],
      limit,
    });
  }
}
