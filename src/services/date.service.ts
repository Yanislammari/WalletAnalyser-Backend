import { AssetPriceRepository, AssetRepository } from "../repositories";

export class DateService {
  private readonly assetRepository : AssetRepository = new AssetRepository()
    private readonly assetPriceRepository : AssetPriceRepository = new AssetPriceRepository()
  constructor() {}

  formatDateToDDMMYYYY(date: Date): string {
    const day: string = date.getUTCDate().toString().padStart(2, "0");
    const month: string = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const year: number = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  transformExcelDateToDbDate(excelString: string) {
    const excelDate = new Date((parseInt(excelString) - 25569) * 86400 * 1000);
    return excelDate;
  }

  isLatestPriceMoreRecentThanToday(todayDateMinusOneDay: Date, comparedDate: Date) {
    // if asset price date est inférieur à aujourd'hui - 1 ( en clair si on le 26 et que le prix est 24 on fetch sinon non)
    return (
      comparedDate.getUTCFullYear() >= todayDateMinusOneDay.getUTCFullYear() &&
      comparedDate.getUTCMonth() >= todayDateMinusOneDay.getUTCMonth() &&
      comparedDate.getUTCDate() >= todayDateMinusOneDay.getUTCDate() - 1
    );
  }

  getDateAtUtc0() {
    const now = new Date();
    const todayUtc0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    return todayUtc0;
  }

  async isAssetPriceUpToDate(ticker: string): Promise<boolean> {
      try {
        const asset = await this.assetRepository.getAssetFromTicker(ticker);
        if (asset) {
          const assetLatestPriceData = await this.assetPriceRepository.getLatestAssetPrice(asset.uuid);
          let latestDate = new Date(0);
          if (assetLatestPriceData) {
            latestDate = assetLatestPriceData.asset_price_date;
          }
          // Our current date must substract one to it
          return this.isLatestPriceMoreRecentThanToday(this.getDateAtUtc0(), latestDate); // if false we refetch
        }
        return false;
      } catch (error) {
        console.error(`Error while checking stock ${ticker}`, error);
        throw error;
      }
    }
}
