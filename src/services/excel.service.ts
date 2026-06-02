import * as XLSX from "xlsx";
import path from "path";
import countries from "world-countries";
import fs from "fs";
import YahooFinance from "yahoo-finance2";

import { Asset, attributesEtfHoldingsAsset } from "../db_schema";
import { MarketstackController } from "../controllers";
import { AssetDatabaseModel, GeographicSector } from "../models";
import { DateService } from ".";
import {
  AssetRepository,
  CountryAlliasRepository,
  CountryRepository,
  SectorRepository,
  CurrenciesRepository,
  EtfHoldingsRepository,
  ForexRepository,
} from "../repositories";
import { AssetType } from "../dtos";
import { ETFHolding, MatchingNames } from "../dtos/asset/etf_concentration";
import { TICKER_COMMON_SPECIAL_CHARS_REGEX, TICKER_COMMON_WORD, TICKER_DELETE_LAST_POINT, TICKER_DELETE_POINT, TICKER_REPLACE_MULTIPLE_SPACES } from "../constants/regex";
import { RfrCountryService } from "./rfr/rfr_country.service";


export class ExcelService {
  private readonly constantPath: string = "../asset/excel/";
  private readonly jsonConstantPath: string = "../asset/json/";

  private defaultAssetTicker: string[] = []// "MSFT", "TTE", "UNH", "BABA", "JPM", "V", "PG", "TSM", "CHT", "RHHBF", "T", "HD", "XOM", "TM", "BA", "HSBC"]; // a terme viendra d'une API officielle
  private defaultETFTicker: string[] = ["QQQM","IVV"]//["IVV", "QQQM","IEUR","IEMG"]

  private readonly currenciesPath: string[] = [path.join(__dirname, this.constantPath, "forex.xlsx")];

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
  private sectorRepository: SectorRepository = new SectorRepository();
  private countryRepository: CountryRepository = new CountryRepository();
  private countryAlliasRepository: CountryAlliasRepository = new CountryAlliasRepository();
  private rfrCountryService : RfrCountryService = new RfrCountryService();
  private forexRepository : ForexRepository = new ForexRepository();
  private etfHoldingsRepository: EtfHoldingsRepository = new EtfHoldingsRepository();

  private yf  = new YahooFinance()
  constructor() {}

  async addDataFromAdmin() {
    await this.addCountryToDatabaseFromCSV();
    await this.addCurrenciesToDatabase();
    await this.addRiskFreeRateToDatabase();
    await this.addAdminStocksToDatabase();
    await this.addConcentrationForAdminEtf();
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
            this.forexRepository.addForexRatesFromExcel(dates, forexRates, forex, forexRates[0] as string);
          }
        }
      }
    } catch (error) {
      console.error("Error adding currencies to the database:", error);
    }
  }

  getGeographicSectorFromTickerFromSpecificSheet(ticker: string, sheets: string[], column = this.tickersColumnIndex): GeographicSector | null {
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



  async sleep(ms : number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async safeQuote(ticker: string) {
    let quote;
    let summary;
    try {
      quote = await this.yf.quote(ticker),
      summary = await this.yf.quoteSummary(ticker, {
        modules: ["assetProfile"]
      })
      return { quote , summary };
    } catch (err : any) {
      return {quote , summary};
    }
  }

  async addAdminStocksToDatabase() {
    try {
      if ((await this.assetRepository.getAllAssets()).length > 25) {
        return;
      }
      const tickers = await this.marketstackController.fetchTickers();
      console.log("Adding stocks to the database");

      for (const index in tickers) {
        if (["TOT"].includes(tickers[index].ticker)) { // to fix some weird ticker that could appear
          continue;
        }
        const ticker = tickers[index].ticker.replace(".","-")
        const { quote, summary } = await this.safeQuote(ticker);
        if(!quote || !quote.longName || !quote.symbol) {
          continue
        }

        let sector, country;
        if(!summary){
          const findEnGeographicSector = this.getGeographicSectorFromTickerFromSpecificSheet(tickers[index].ticker, this.stocksSheetNameEn);
          sector = await this.sectorRepository.getSectorByName(findEnGeographicSector?.sector_name ?? "");
          country = await this.countryRepository.getCountryByName(findEnGeographicSector?.country_name?? "");
        }

        else {
          sector = summary.assetProfile?.sector ? await this.sectorRepository.getSectorByName(summary.assetProfile.sector) : null;
          if(!sector && summary.assetProfile?.sector) {
            sector = await this.sectorRepository.addSectorToDatabase(summary.assetProfile?.sector ?? "")
          }
          country = summary.assetProfile?.country ? await this.countryRepository.getCountryByName(summary.assetProfile.country) : null;
        }
        const currency = await this.currenciesRepository.getCurenciesFromDb(quote.currency)
        const asset_type = quote.quoteType != "EQUITY" ? AssetType.ETF : AssetType.STOCKS

        await this.sleep(1000)
        const assetDatabase = new AssetDatabaseModel(quote.displayName ?? quote.longName, quote.longName, quote.symbol, asset_type, 
          sector?.uuid ?? null, country?.uuid ?? null, currency?.uuid ?? null
        );
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

  async matchETFHoldingsAndDBasset(etfHoldingName: string, title : string): Promise<Asset | null> {
    const fixedName: MatchingNames[] = [
      {name_json : "Apple, Inc", name_db : "Apple Inc"},
      {name_json : "PPL Corp.", name_db: "PPL Corp"},
    ]
    const fixedTitle: MatchingNames[] = [
      {name_json : "Alphabet, Inc., Class A", name_db : "GOOG"},
      {name_json : "Alphabet, Inc., Class C", name_db: "GOOGL"},
    ]
    let asset;
    const findName = fixedName.find((value) => value.name_json == etfHoldingName)
    if(findName) {  
      asset = await this.assetRepository.getAssetFromOfficialName(findName?.name_db);
      return asset
    }
    const findTitle = fixedTitle.find((value) => value.name_json == title)
    if(findTitle) {
      asset = await this.assetRepository.getAssetFromTicker(findTitle?.name_db);
      return asset
    }
    asset = await this.assetRepository.getClosestAssetFromOfficialName(etfHoldingName);
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
      const data = fs.readFileSync(path.join(__dirname, this.jsonConstantPath, `${ticker}_holdings.json`), "utf-8");
      const holdings = JSON.parse(data);
      let etf = await this.assetRepository.getAssetFromTicker(ticker);
      if (etf == null) {
        const name = holdings.basics.fund_name;
        const quote = await this.yf.quote(ticker)
        const currency = await this.currenciesRepository.getByName(quote.currency)
        etf = await this.assetRepository.addStrictlyNewAssetFromAssetToDatabase(new AssetDatabaseModel(name, name, ticker, AssetType.ETF, null, null, currency?.uuid ?? null));
      }
      const existingHoldings = await this.etfHoldingsRepository.getEtfHoldingsFromEtf(etf.uuid);
      if (existingHoldings.length > 0) {
        continue;
      }

      console.log("Adding concentration for etf ", ticker);
      await this.updateAllConcentrationForEtf( holdings, etf )
    }
  }

  async updateAllConcentrationForEtf(holdings : any, etf : Asset ){
    await this.etfHoldingsRepository.deleteAllHoldingsOfAnEtf(etf.uuid)
    const holdingsList = holdings.output.holdings as ETFHolding[];
    for (const holding of holdingsList) {
      let asset = await this.matchETFHoldingsAndDBasset(holding.investment_security.name, holding.investment_security.title);
      if (asset == null) {
        const options = await this.yf.search(holding.investment_security.name)
        const filtered = options.quotes.filter(q => {
          const name = q.shortname as string | undefined;
          if (!name) return false;

          const firstName = name.split(" ")[0].toLowerCase();

          return holding.investment_security.name
            .toLowerCase()
            .includes(firstName);
        });
        if( filtered.length == 0) { // nothing found
          asset = await this.assetRepository.addStrictlyNewAssetFromAssetToDatabase(new AssetDatabaseModel(null, holding.investment_security.name, null, AssetType.STOCKS, null, null, null))
        }
        else {
          const { quote, summary } = await this.safeQuote(filtered[0].symbol as string);
          await this.sleep(1000)
          if(!quote || !quote.longName || !quote.symbol) {
            asset = await this.assetRepository.addStrictlyNewAssetFromAssetToDatabase(new AssetDatabaseModel(null, holding.investment_security.name, null, AssetType.STOCKS, null, null, null))
          }
          else {
            let sector;
            if(!summary){
              const findEnGeographicSector = this.getGeographicSectorFromTickerFromSpecificSheet(filtered[0].symbol as string, this.stocksSheetNameEn);
              sector = await this.sectorRepository.getSectorByName(findEnGeographicSector?.sector_name ?? "");
            }
            else {
              sector = summary.assetProfile?.sector ? await this.sectorRepository.getSectorByName(summary.assetProfile.sector) : null;
              if(!sector && summary.assetProfile?.sector) {
                sector = await this.sectorRepository.addSectorToDatabase(summary.assetProfile?.sector ?? "")
              }
            }
            const currency = await this.currenciesRepository.getCurenciesFromDb(quote.currency)
            const asset_type = quote.quoteType != "EQUITY" ? AssetType.ETF : AssetType.STOCKS
            const country = await this.countryRepository.getCountryByName(holding.investment_security.invested_country);

            const assetDatabase = new AssetDatabaseModel(quote.displayName ?? quote.longName, quote.longName, quote.symbol, asset_type, 
              sector?.uuid ?? null, country?.uuid ?? null, currency?.uuid ?? null
            );
            asset = await this.assetRepository.addStrictlyNewAssetFromAssetToDatabase(assetDatabase);
          }
        }
      }

      const existEtfHolding = await this.etfHoldingsRepository.getEtfHoldings(asset.uuid, etf.uuid)
      if( existEtfHolding ) {
        await this.etfHoldingsRepository.update(existEtfHolding.uuid, {
          [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf] : holding.investment_security.percent_value
        })
      }
      else {
        await this.etfHoldingsRepository.createEtfHoldings(etf.uuid, asset.uuid, holding.investment_security.percent_value);
      }
    }
  }
}
