import * as XLSX from "xlsx";
import path from "path";
import { geographicSectorDefaultValue } from "../messages";
import { Forex } from "../db_schema";
import { MarketstackController } from "../controllers";
import { AssetDatabaseModel, AssetPriceCompletModel, GeographicSector } from "../models";
import { DateService } from ".";
import {
  AssetRepository,
  AssetPriceRepository,
  RfrRepository,
  CountryConcentrationRepository,
  SectorConcentrationRepository,
  CountryAlliasRepository,
  CountryRepository,
  SectorAlliasRepository,
  SectorRepository,
  CurrenciesRepository,
} from "../repositories";

export class ExcelService {
  private constantPath: string = "../asset/excel/";
  private defaultAssetTicker: string[] = ["MSFT"]; //, "TTE","UNH","BABA","JPM","V","PG","TSM","CHT","RHHBF","T","HD","XOM","TM","BA","HSBC"] // a terme viendra d'une API officielle
  private currenciesPath: string[] = [path.join(__dirname, this.constantPath, "official_currencies_rate.xlsx")];
  private majorCurrencies: string[] = ["USD"]; //,"EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"];
  private risksFreeRatePath: string[] = [path.join(__dirname, this.constantPath, "risk_free_rate_usa.xlsx")];
  private stocksPath: string[] = [path.join(__dirname, this.constantPath, "official_stocks_api.xlsx")];
  private stocksSheetNameFr: string[] = ["usa_fr", "europe_fr", "world_ex_usa_fr"];
  private stocksSheetNameEn: string[] = ["usa_en", "europe_en", "world_ex_usa_en"];
  private tickersColumnIndex: number = 3;
  private countryColumnIndex: number = 2;
  private sectorColumnIndex: number = 1;
  private assetNameColumnIndex: number = 0;

  private currenciesRepository: CurrenciesRepository = new CurrenciesRepository();
  private marketstackController: MarketstackController = new MarketstackController();
  private assetRepository: AssetRepository = new AssetRepository();
  private dateService: DateService = new DateService();
  private assetPriceRepository: AssetPriceRepository = new AssetPriceRepository();
  private sectorRepository: SectorRepository = new SectorRepository();
  private sectorAlliasRepository: SectorAlliasRepository = new SectorAlliasRepository();
  private sectorConcentrationRepository: SectorConcentrationRepository = new SectorConcentrationRepository();
  private countryRepository: CountryRepository = new CountryRepository();
  private countryAlliasRepository: CountryAlliasRepository = new CountryAlliasRepository();
  private countryConcentrationRepository: CountryConcentrationRepository = new CountryConcentrationRepository();
  private rfrRepository: RfrRepository = new RfrRepository();

  constructor() {}

  async addDataFromAdmin() {
    await this.addCurrenciesToDatabase();
    await this.addAdminStocksToDatabase();
    await this.addRiskFreeRateToDatabase();
  }

  openExcelFile(filePath: string, workSheetName: string | undefined): XLSX.WorkSheet {
    try {
      const workbook = XLSX.readFile(filePath);
      if (!workSheetName) {
        workSheetName = workbook.SheetNames[0];
      }
      const worksheet = workbook.Sheets[workSheetName];
      return worksheet;
    } catch (error) {
      console.error(`Error opening Excel file at ${filePath}:`, error);
      throw error;
    }
  }

  getExcelSize(worksheet: XLSX.WorkSheet): XLSX.Range {
    return XLSX.utils.decode_range(worksheet["!ref"]!);
  }

  readExcelColumn(worksheet: XLSX.WorkSheet, columnIndex: number, range: XLSX.Range): string[] {
    const columnData: string[] = [];
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
      const cellAddress = { c: columnIndex, r: rowIndex };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = worksheet[cellRef];
      columnData.push(cell ? cell.v : "");
    }
    return columnData;
  }

  findRowIndexOfTicker(worksheet: XLSX.WorkSheet, columnIndex: number, range: XLSX.Range, ticker: string): number {
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
      const cellAddress = { c: columnIndex, r: rowIndex };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = worksheet[cellRef];
      if (cell && cell.v === ticker) {
        return rowIndex;
      }
    }
    return -1;
  }

  readCellValue(worksheet: XLSX.WorkSheet, columnIndex: number, rowIndex: number): string {
    const cellAddress = { c: columnIndex, r: rowIndex };
    const cellRef = XLSX.utils.encode_cell(cellAddress);
    const cell = worksheet[cellRef];
    return cell ? cell.v : "";
  }

  async addCurrenciesToDatabase() {
    try {
      const euroBaseCurrency = await this.currenciesRepository.addCurrencyToDb("EUR" as string);
      for (const path of this.currenciesPath) {
        const worksheet = this.openExcelFile(path, undefined);
        const range = this.getExcelSize(worksheet);

        const dates = this.readExcelColumn(worksheet, 0, range).map(date => this.dateService.transformExcelDateToDbDate(date));

        for (let i = 1; i <= range.e.c; i++) {
          const forexRates = this.readExcelColumn(worksheet, i, range);
          const quoteCurrency = await this.currenciesRepository.addCurrencyToDb(forexRates[0] as string);
          if (euroBaseCurrency && quoteCurrency) {
            const forex = await this.currenciesRepository.addForexToDb(euroBaseCurrency.uuid, quoteCurrency.uuid);
            this.addPriceCurrenciesFromExcel(dates, forexRates, forex, forexRates[0] as string);
          }
        }
      }
    } catch (error) {
      console.error("Error adding currencies to the database:", error);
    }
  }

  async addPriceCurrenciesFromExcel(dates: Date[], forexRates: string[], forex: Forex, quoteCurrencyName: string) {
    const latestForexRateUpdate = await this.currenciesRepository.getLatestForexRateFromDb(forex.uuid);
    let latestDate = new Date(0);
    if (latestForexRateUpdate) {
      latestDate = latestForexRateUpdate.forex_rate_date;
    }
    const isMajor = this.majorCurrencies.includes(quoteCurrencyName);
    for (let j = 1; j < forexRates.length; j++) {
      if (dates[j] <= latestDate) {
        break;
      }
      const dayOfWeek = dates[j].getDay();
      if (!isMajor && dayOfWeek != 5) continue; // for non major currency, we only add the price of friday
      const forexRate = parseFloat(forexRates[j] as string);
      if (isNaN(forexRate)) {
        continue;
      }
      await this.currenciesRepository.addForexRateToDb(forex, dates[j], forexRate);
    }
  }

  getGeographicSectorFromTickerFromSpecificSheet(ticker: string, sheets: string[]): GeographicSector | null {
    try {
      for (const path of this.stocksPath) {
        for (const sheetName of sheets) {
          const worksheet = this.openExcelFile(path, sheetName);
          const range = this.getExcelSize(worksheet);
          const rowIndexTicker = this.findRowIndexOfTicker(worksheet, this.tickersColumnIndex, range, ticker);
          if (rowIndexTicker !== -1) {
            const sector = this.readCellValue(worksheet, this.sectorColumnIndex, rowIndexTicker);
            const country = this.readCellValue(worksheet, this.countryColumnIndex, rowIndexTicker);
            return new GeographicSector(sector, country);
          }
        }
        return new GeographicSector(geographicSectorDefaultValue, geographicSectorDefaultValue);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching sectors for ticker ${ticker} from Excel:`, error);
      return null;
    }
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
        return this.dateService.isLatestPriceMoreRecentThanToday(this.dateService.getDateAtUtc0(), latestDate); // if false we refetch
      }
      return false;
    } catch (error) {
      console.error(`Error while checking stock ${ticker}`, error);
      throw error;
    }
  }

  async addAdminStocksToDatabase() {
    try {
      for (const ticker of this.defaultAssetTicker) {
        const isTickerUpToDate = await this.isAssetPriceUpToDate(ticker);
        if (isTickerUpToDate) {
          continue;
        }
        console.log("Fetching ticker price date", ticker);

        const assetInfo = await this.marketstackController.fetchTickerInfo(ticker);
        const assetPrice = await this.marketstackController.fetchHistoricalData(ticker);
        const assetInfoPrice = assetPrice[0] as AssetPriceCompletModel;
        const currency = await this.currenciesRepository.getCurenciesFromDb(assetInfoPrice.price_currency);
        const asset = await this.assetRepository.addAssetFromAssetToDatabase(
          new AssetDatabaseModel(currency?.uuid ?? null, assetInfo.name, assetInfo.ticker, assetInfo.exchange_code, assetInfoPrice.asset_type)
        );

        const latestPrice = await this.assetPriceRepository.getLatestAssetPrice(asset.uuid);
        let latestDate = new Date(0);
        if (latestPrice) {
          latestDate = latestPrice.asset_price_date;
        }
        let i = 0;
        while (i < assetPrice.length && assetPrice[i].date > latestDate) {
          await this.assetPriceRepository.addAssetPrice(asset.uuid, assetPrice[i].date, assetPrice[i].adj_close);
          i++;
        }

        const findEnGeographicSector = this.getGeographicSectorFromTickerFromSpecificSheet(ticker, this.stocksSheetNameEn);
        const findFrGeographicSector = this.getGeographicSectorFromTickerFromSpecificSheet(ticker, this.stocksSheetNameFr);
        const officialSector = await this.sectorRepository.addSectorToDatabase(findFrGeographicSector?.sector ?? geographicSectorDefaultValue);
        await this.sectorConcentrationRepository.addSectorConcentrationToDatabase(asset.uuid, officialSector.uuid, 100);
        if (findEnGeographicSector?.sector) {
          await this.sectorAlliasRepository.addSectorAlliasToDatabase(officialSector.uuid, findEnGeographicSector?.sector);
          await this.sectorAlliasRepository.addSectorAlliasToDatabase(officialSector.uuid, assetInfo.sector);
        }
        const officialCountry = await this.countryRepository.addCountryToDatabase(findFrGeographicSector?.country ?? geographicSectorDefaultValue);
        await this.countryConcentrationRepository.addCountryConcentrationToDatabase(asset.uuid, officialCountry.uuid, 100);
        if (findEnGeographicSector?.country) {
          await this.countryAlliasRepository.addCountryAlliasToDatabase(officialCountry.uuid, findEnGeographicSector?.country);
        }
      }
    } catch (error) {
      console.error("Error adding stocks to the database:", error);
    }
  }

  async intializeCoutryAllias() {
    const USAcoutnryUuid = await this.countryRepository.getCountryByName("United States");
    if (USAcoutnryUuid?.uuid) {
      await this.countryAlliasRepository.addCountryAlliasToDatabase(USAcoutnryUuid?.uuid, "USA");
    }
  }

  async addRiskFreeRateToDatabase() {
    try {
      await this.intializeCoutryAllias();
      for (const path of this.risksFreeRatePath) {
        const worksheet = this.openExcelFile(path, undefined);
        const range = this.getExcelSize(worksheet);

        const percent_rates = this.readExcelColumn(worksheet, 1, range);
        const countryUuid = await this.countryRepository.getCountryByName(percent_rates[0]); // percent rate first value store in fact a country name
        const dates = this.readExcelColumn(worksheet, 0, range).map(date => this.dateService.transformExcelDateToDbDate(date));
        if (!countryUuid?.uuid) {
          throw Error("Cant get a country for rfr");
        }

        const seenMonths = new Set();
        const latestRate = await this.rfrRepository.getLatestRfr(countryUuid.uuid);
        let latestDate = new Date(0);
        if (latestRate) {
          latestDate = latestRate.rfr_date;
          const monthKey = `${latestDate.getFullYear()}-${latestDate.getMonth()}`;
          seenMonths.add(monthKey);
        }

        for (let i = dates.length - 1; i > 0; i--) {
          if (dates[i] <= latestDate) {
            break;
          }
          const parsedValue = parseFloat(percent_rates[i]);
          const d = new Date(dates[i]);
          if (Number.isNaN(parsedValue)) continue;

          const monthKey = `${d.getFullYear()}-${d.getMonth()}`; // unique per month
          if (!seenMonths.has(monthKey)) {
            seenMonths.add(monthKey);
            await this.rfrRepository.addRfrToDb(countryUuid.uuid, dates[i], parsedValue);
          }
        }
      }
    } catch (e) {
      console.error("Error adding rfr to the database:", e);
    }
  }
}
