import * as XLSX from "xlsx";
import path from "path";
import countries from "world-countries";
import fs from "fs";
import { Asset, Forex } from "../db_schema";
import { MarketstackController } from "../controllers";
import { AssetDatabaseModel, AssetPriceCompletModel, GeographicSector } from "../models";
import { DateService } from ".";
import {
  AssetRepository,
  AssetPriceRepository,
  CountryAlliasRepository,
  CountryRepository,
  SectorAlliasRepository,
  SectorRepository,
  CurrenciesRepository,
  EtfHoldingsRepository,
} from "../repositories";
import { AssetType } from "../dtos";
import { ETFHolding } from "../dtos/asset/etf_concentration";
import { TICKER_COMMON_SPECIAL_CHARS_REGEX, TICKER_COMMON_WORD, TICKER_DELETE_LAST_POINT, TICKER_DELETE_POINT, TICKER_REPLACE_MULTIPLE_SPACES } from "../constants/regex";
import { RfrCountryService } from "./rfr/rfr_country.service";

export class ExcelService {
  private constantPath: string = "../asset/excel/";
  private jsonConstantPath: string = "../asset/json/";

  private defaultAssetTicker: string[] = []// "MSFT", "TTE", "UNH", "BABA", "JPM", "V", "PG", "TSM", "CHT", "RHHBF", "T", "HD", "XOM", "TM", "BA", "HSBC"]; // a terme viendra d'une API officielle
  private defaultETFTicker: string[] = []//"IVV", "QQQM"]; //,"IEUR","IEMG"]

  private currenciesPath: string[] = [path.join(__dirname, this.constantPath, "forex.xlsx")];
  private majorCurrencies: string[] = ["USD"]; //,"EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"];

  private risksFreeRateFolderPath: string = path.join(__dirname, this.constantPath, "rfr");
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
  private countryRepository: CountryRepository = new CountryRepository();
  private countryAlliasRepository: CountryAlliasRepository = new CountryAlliasRepository();
  private rfrCountryService : RfrCountryService = new RfrCountryService();
  private etfHoldingsRepository: EtfHoldingsRepository = new EtfHoldingsRepository();

  constructor() {}

  async addDataFromAdmin() {
    await this.addCountryToDatabaseFromCSV();
    await this.addCurrenciesToDatabase();
    //await this.addRiskFreeRateToDatabase();
    //await this.addAdminStocksToDatabase();
    //await this.addPricesForAdminAsset();
    //await this.addConcentrationForAdminEtf();
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

  async addCountryToDatabaseFromCSV() {
    try {
      const allCountries = await this.countryRepository.getAllCountries();
      if (allCountries.length > 0) {
        return;
      }
      console.log("Fetching english country from csv");
      const countryData = countries.map(c => {
        return {
          englishName: c.name.common,
          code2: c.cca2,
          code3: c.cca3,
        };
      });
      for (const c of countryData) {
        const country = await this.countryRepository.addCountryToDatabase(c.englishName);
        await this.countryAlliasRepository.addCountryAlliasToDatabase(country.uuid, c.code2);
        await this.countryAlliasRepository.addCountryAlliasToDatabase(country.uuid, c.code3);
      }
    } catch (e) {
      console.error("Error adding country to db", e);
    }
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
        //console.log("Stop running at index", j , "for currency", quoteCurrencyName);
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

  async getGeographicSectorFromTickerFromSpecificSheet(ticker: string, sheets: string[], column = this.tickersColumnIndex): Promise<GeographicSector | null> {
    try {
      for (const path of this.stocksPath) {
        for (const sheetName of sheets) {
          const worksheet = this.openExcelFile(path, sheetName);
          const range = this.getExcelSize(worksheet);
          const rowIndexTicker = this.findRowIndexOfTicker(worksheet, column, range, ticker);
          if (rowIndexTicker !== -1) {
            const sector = this.readCellValue(worksheet, this.sectorColumnIndex, rowIndexTicker);
            const country = this.readCellValue(worksheet, this.countryColumnIndex, rowIndexTicker);
            return new GeographicSector(sector, country);
          }
        }
        return null;
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

  async addPricesForAdminAsset() {
    const allAssets = this.defaultAssetTicker.concat(this.defaultETFTicker);
    for (const ticker of allAssets) {
      try {
        const isTickerUpToDate = await this.isAssetPriceUpToDate(ticker);
        if (isTickerUpToDate) {
          continue;
        }
        console.log("Fetching ticker price date", ticker);
        const assetPrice = await this.marketstackController.fetchHistoricalData(ticker);
        const assetInfoPrice = assetPrice[0] as AssetPriceCompletModel;
        const currency = await this.currenciesRepository.getCurenciesFromDb(assetInfoPrice.price_currency);

        let asset = await this.assetRepository.getAssetFromTicker(ticker);
        if (asset == null) {
          const findEnGeographicSector = await this.getGeographicSectorFromTickerFromSpecificSheet(ticker, this.stocksSheetNameEn);
          let sector_uuid = null;
          let country_uuid = null;
          if (findEnGeographicSector?.sector_name) {
            const sectorInDb = await this.sectorRepository.getSectorByName(findEnGeographicSector?.sector_name);
            sector_uuid = sectorInDb?.uuid ?? null;
          }
          if (findEnGeographicSector?.country_name) {
            const country = await this.countryRepository.getCountryByName(findEnGeographicSector?.country_name);
            country_uuid = country?.uuid ?? null;
          }
          if (this.defaultETFTicker.includes(ticker)) {
            sector_uuid = null;
            country_uuid = null;
            assetInfoPrice.asset_type = AssetType.ETF;
          }
          const assetDatabase = new AssetDatabaseModel(assetInfoPrice.name, ticker, assetInfoPrice.asset_type, sector_uuid, country_uuid, currency?.uuid ?? null);
          asset = await this.assetRepository.addAssetFromAssetToDatabase(assetDatabase);
        }
        if (asset.base_currency_uuid == null) {
          await this.assetRepository.patchCurrencyUUIDAsset(asset.uuid, currency?.uuid ?? null);
        }

        const latestPrice = await this.assetPriceRepository.getLatestAssetPrice(asset.uuid);
        let latestDate = new Date(0);
        if (latestPrice) {
          latestDate = latestPrice.asset_price_date;
        }
        let i = 0;
        while (i < assetPrice.length && assetPrice[i].date > latestDate) {
          if (isNaN(assetPrice[i].adj_close) || assetPrice[i].adj_close == 0) {
            i++;
            continue;
          }
          await this.assetPriceRepository.addAssetPrice(asset.uuid, assetPrice[i].date, assetPrice[i].adj_close);
          i++;
        }
      } catch (error) {
        console.error(`Error while adding price for stock ${ticker}`, error);
      }
    }
  }

  async addAdminStocksToDatabase() {
    try {
      if ((await this.assetRepository.getAllAssets()).length > 25) {
        return;
      }
      const tickers = await this.marketstackController.fetchTickers();
      for (const index in tickers) {
        if (["TOT"].includes(tickers[index].ticker)) {
          // to fix some weird ticker that could appear
          continue;
        }

        const assetDatabase = new AssetDatabaseModel(tickers[index].name, tickers[index].ticker, AssetType.STOCKS, null, null, null);

        const findEnGeographicSector = await this.getGeographicSectorFromTickerFromSpecificSheet(tickers[index].ticker, this.stocksSheetNameEn);
        if (findEnGeographicSector?.sector_name) {
          let sectorInDb = await this.sectorRepository.getSectorByName(findEnGeographicSector?.sector_name);
          if (!sectorInDb) {
            const tickerInfo = await this.marketstackController.fetchTickerInfo(tickers[index].ticker);
            console.log("fetch ticker info ", tickerInfo.sector);
            if (tickerInfo.sector != "") {
              sectorInDb = await this.sectorRepository.addSectorToDatabase(tickerInfo.sector!);
              if (sectorInDb.sector_name.toLowerCase() !== findEnGeographicSector?.sector_name.toLowerCase()) {
                await this.sectorAlliasRepository.addSectorAlliasToDatabase(sectorInDb.uuid, findEnGeographicSector?.sector_name);
              }
            }
          }
          assetDatabase.sector_uuid = sectorInDb?.uuid ?? null;
        }
        if (findEnGeographicSector?.country_name) {
          const country = await this.countryRepository.getCountryByName(findEnGeographicSector?.country_name);
          assetDatabase.country_uuid = country?.uuid ?? null;
        }
        if (assetDatabase.official_name?.includes("ETF")) {
          assetDatabase.asset_type = AssetType.ETF;
        }
        await this.assetRepository.addAssetFromAssetToDatabase(assetDatabase);
      }
    } catch (error) {
      console.error("Error adding stocks to the database:", error);
    }
  }

  async addRiskFreeRateToDatabase() {
    try {
      fs.readdir(this.risksFreeRateFolderPath, (err, files) => {
        if (err) {
          return console.error("Error reading folder:", err);
        }
        files.forEach(async file => {
          const filePath = path.join(this.risksFreeRateFolderPath, file);
          const worksheet = this.openExcelFile(filePath, undefined);
          const range = this.getExcelSize(worksheet);

          const percent_rates = this.readExcelColumn(worksheet, 1, range);
          const countryUuid = await this.countryRepository.getCountryByName(path.parse(filePath).name.split("_")[1]); // we suppose that the file name is like rfr_countryname.xlsx
          const dates = this.readExcelColumn(worksheet, 0, range).map(date => this.dateService.transformExcelDateToDbDate(date));
          if (!countryUuid?.uuid) {
            throw Error("Cant get a country for rfr");
          }
          this.rfrCountryService.createRfrCountry(countryUuid.uuid, dates, percent_rates)
        });
      });
    } catch (e) {
      console.error("Error adding rfr to the database:", e);
    }
  }

  async matchETFHoldingsAndDBasset(etfHoldingName: string): Promise<Asset | null> {
    let asset = await this.assetRepository.getClosestAssetFromOfficialName(etfHoldingName);
    let alliasName = null;
    if (asset == null) {
      alliasName = etfHoldingName
        .replace(TICKER_COMMON_WORD, "")
        .replace(TICKER_DELETE_POINT, "")
        .replace(TICKER_COMMON_SPECIAL_CHARS_REGEX, "")
        .trim()
        .replace(TICKER_DELETE_LAST_POINT, "")
        .trim()
        .replace(TICKER_REPLACE_MULTIPLE_SPACES, " ");
      asset = await this.assetRepository.getClosestAssetFromOfficialName(alliasName.replace("'", "`"));
    }
    if (asset == null) {
      const parts = etfHoldingName.split(" ");
      if (parts.length >= 3) {
        for (let i = 0; i < parts.length - 1; i++) {
          const partialName = parts.slice(0, i + 1).join(" ");
          asset = await this.assetRepository.getClosestAssetFromOfficialName(partialName);
        }
      }
    }
    if (asset == null) {
      const parts = alliasName!.split(" ");
      if (parts.length >= 3) {
        for (let i = 0; i < parts.length - 1; i++) {
          const partialName = parts.slice(0, i + 1).join(" ");
          asset = await this.assetRepository.getClosestAssetFromOfficialName(partialName);
        }
      }
    }
    return asset;
  }

  async addConcentrationForAdminEtf() {
    // take 30 seconds / per 100 stocks
    for (const ticker of this.defaultETFTicker) {
      try {
        const data = fs.readFileSync(path.join(__dirname, this.jsonConstantPath, `${ticker}_holdings.json`), "utf-8");
        const holdings = JSON.parse(data);
        let etf = await this.assetRepository.getAssetFromTicker(ticker);
        if (etf == null) {
          const name = holdings.basics.fund_name;
          etf = await this.assetRepository.addAssetFromAssetToDatabase(new AssetDatabaseModel(name, ticker, AssetType.ETF, null, null, null));
        }
        const existingHoldings = await this.etfHoldingsRepository.getEtfHoldingsFromEtf(etf.uuid);
        if (existingHoldings.length > 0) {
          continue;
        }
        console.log("Adding concentration for etf ", ticker);
        const holdingsList = holdings.output.holdings as ETFHolding[];
        for (const holding of holdingsList) {
          let asset = await this.matchETFHoldingsAndDBasset(holding.investment_security.name);
          if (asset == null) {
            asset = await this.assetRepository.addAssetFromAssetToDatabase(new AssetDatabaseModel(holding.investment_security.name, null, null, null, null, null));
          }
          const assetDatabase = new AssetDatabaseModel(
            asset ? asset.official_name : holding.investment_security.name,
            asset ? asset.ticker_name : null,
            Object.values(AssetType).includes(asset?.asset_type as AssetType) ? (asset.asset_type as AssetType) : null,
            asset ? asset.sector_uuid : null,
            asset ? asset.country_uuid : null,
            asset ? asset.base_currency_uuid : null
          );
          const geographicSector = await this.getGeographicSectorFromTickerFromSpecificSheet(holding.investment_security.name, this.stocksSheetNameEn, this.assetNameColumnIndex);
          if (geographicSector?.sector_name && !assetDatabase.sector_uuid) {
            let sectorInDb = await this.sectorRepository.getSectorByName(geographicSector.sector_name);
            assetDatabase.sector_uuid = sectorInDb?.uuid ?? null;
          }
          if (!assetDatabase.country_uuid) {
            const country = await this.countryRepository.getCountryByName(holding.investment_security.invested_country);
            assetDatabase.country_uuid = country?.uuid ?? null;
          }
          asset = await this.assetRepository.patchAssetInfo(asset.uuid, assetDatabase);
          await this.etfHoldingsRepository.createEtfHoldings(etf.uuid, asset!.uuid, holding.investment_security.percent_value);
        }
      } catch (error) {
        console.error(`Error while adding concentration for etf ${ticker}`, error);
      }
    }
  }
}
