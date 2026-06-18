import { Asset } from "../db_schema/asset/asset";
import { Currency } from "../db_schema/currencies/currency";
import { CurrenciesRepository } from "../repositories";
import { AssetRepository } from "../repositories/asset/asset.repository";
import { YahooFinanceService } from "./yahoo.finance.service";

export class AssetBaseCurrencySyncService {
  private readonly assetRepository: AssetRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly yahooFinanceService: YahooFinanceService;

  constructor() {
    this.assetRepository = new AssetRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.yahooFinanceService = new YahooFinanceService();
  }

  public async syncBaseCurrencies(): Promise<void> {
    const assets: Asset[] = await this.assetRepository.getAllAssets();
    console.log(`[BaseCurrencySync] Total assets in DB: ${assets.length}`);

    const assetsWithoutCurrency: Asset[] = assets.filter(
      (asset) => asset.ticker_name != null && asset.base_currency_uuid == null
    );
    console.log(`[BaseCurrencySync] Assets with ticker but no base currency: ${assetsWithoutCurrency.length}`);

    if (assetsWithoutCurrency.length === 0) {
      console.log(`[BaseCurrencySync] Nothing to do, all assets already have a base currency.`);
      return;
    }

    const tickers: string[] = assetsWithoutCurrency.map((asset) => asset.ticker_name!);
    console.log(`[BaseCurrencySync] Fetching currencies from Yahoo for ${tickers.length} tickers...`);

    const currencyMap: Map<string, string> = await this.yahooFinanceService.fetchCurrenciesForTickers(tickers);
    console.log(`[BaseCurrencySync] Yahoo returned currencies for ${currencyMap.size} tickers`);

    let updated = 0;
    let skipped = 0;

    for (const asset of assetsWithoutCurrency) {
      const currencyCode: string | undefined = currencyMap.get(asset.ticker_name!);

      if (!currencyCode) {
        skipped++;
        continue;
      }

      try {
        const currency: Currency = await this.currenciesRepository.addCurrencyToDb(currencyCode);
        await this.assetRepository.patchCurrencyUUIDAsset(asset.uuid, currency.uuid);
        updated++;
      }
      catch (err: unknown) {
        console.error(
          `[BaseCurrencySync] Error syncing currency for ${asset.ticker_name} - ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    console.log(`[BaseCurrencySync] Done — updated: ${updated}, skipped (no Yahoo result): ${skipped}`);
  }
}
