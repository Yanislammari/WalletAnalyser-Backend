import { fn, col, Op } from "sequelize";
import { AssetDividend } from "../../db_schema/asset/asset_dividend";
import { BaseRepository } from "../base.repository";

export class AssetDividendRepository extends BaseRepository<AssetDividend> {
  constructor() {
    super(AssetDividend);
  }

  public async getDividendsAfterDate(assetId: string, date: string): Promise<AssetDividend[]> {
    return this.model.findAll({
      where: {
        asset_uuid: assetId,
        ex_date: { [Op.gte]: date },
      },
      order: [["ex_date", "ASC"]],
    });
  }

  public async getOldestDividendDatesByAssets(assetIds: string[]): Promise<Map<string, Date>> {
    const rows = await AssetDividend.findAll({
      where: { asset_uuid: { [Op.in]: assetIds } },
      attributes: ["asset_uuid", [fn("MIN", col("ex_date")), "oldest_date"]],
      group: ["asset_uuid"],
      raw: true,
    }) as unknown as Array<{ asset_uuid: string; oldest_date: string }>;

    const result = new Map<string, Date>();
    for (const row of rows) {
      result.set(row.asset_uuid, new Date(row.oldest_date));
    }
    return result;
  }

  public async bulkCreate(
    records: Array<{ asset_uuid: string; dividend_amount: number; ex_date: Date | string }>
  ): Promise<void> {
    if (records.length === 0) return;
    await AssetDividend.bulkCreate(records as any, { ignoreDuplicates: true });
  }

  /**
   * Insert or update dividend records.
   * Uses the unique (asset_uuid, ex_date) constraint — if a record already exists
   * for that date its amount is updated in place (handles revised dividend announcements).
   */
  public async upsertBulk(
    records: Array<{ asset_uuid: string; dividend_amount: number; ex_date: Date | string }>
  ): Promise<void> {
    if (records.length === 0) return;
    await AssetDividend.bulkCreate(records as any, { updateOnDuplicate: ["dividend_amount"] });
  }
}
