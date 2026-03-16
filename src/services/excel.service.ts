import CurrenciesService from "./currencies.service";
import DateService from "./date.service";
import * as XLSX from 'xlsx';
import path from 'path';
import { Asset, Forex } from "../db_schema";
import MarketstackService from "./marketstack/marketstack.service";
import { AssetDatabaseModel, AssetPriceCompleteModel } from "../models";
import AssetService from "./asset/asset.service";

export default class ExcelService {

  private constantPath : string = "../asset/excel/"
  private defaultAssetTicker : string[] = ["MSFT"]//, "TTE","UNH","BABA","NVDA","JPM","V","PG","TSM","CHT","RHHBF","T","HD","XOM","MRK","NVS","CMCSA","TM","BA","HSBC","NRG"] // a terme viendra d'une API officielle
  private currenciesPath : string[] = [path.join(__dirname,this.constantPath,'official_currencies_rate.xlsx')]
  private majorCurrencies : string[] = ["USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"];
  private risksFreeRatePath : string[] = ["..\src\excel\risk_free_rate_usa.xlsx"]
  private stocksPath : string[] = ["../asset/excel/official_stocks_api.xlsx"]
  private stocksSheetNameFr : string[] = ["usa_fr","europe_fr","world_ex_usa_fr"]
  private stocksSheetNameEn : string[] = ["usa_en","europe_en","world_ex_usa_en"]
  private tickersColumnIndex : number = 4;
  private countryColumnIndex : number = 3;
  private sectorColumnIndex : number = 2;
  private assetNameColumnIndex : number = 1;

  private currenciesService : CurrenciesService = new CurrenciesService();
  private marketstackService : MarketstackService = new MarketstackService();
  private assetService : AssetService = new AssetService();
  private dateService : DateService = new DateService();

  constructor() {

  }

  async addDataFromAdmin() {
    await this.addCurrenciesToDatabase();
    //await this.addStocksToDatabase();
  }

  openExcelFile(filePath : string, workSheetName : string | undefined) : XLSX.WorkSheet {
    try {
      const workbook = XLSX.readFile(filePath);
      if(!workSheetName) {
        workSheetName = workbook.SheetNames[0];
      }
      const worksheet = workbook.Sheets[workSheetName];
      return worksheet;
    }
    catch (error) {
      console.error(`Error opening Excel file at ${filePath}:`, error);
      throw error;
    }
  }

  getExcelSize(worksheet : XLSX.WorkSheet) : XLSX.Range {
    return XLSX.utils.decode_range(worksheet['!ref']!);
  }

  readExcelColumn(worksheet : XLSX.WorkSheet, columnIndex : number, range : XLSX.Range) : string[] {
    const columnData : string[] = [];
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
      const cellAddress = { c: columnIndex, r: rowIndex };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = worksheet[cellRef];
      columnData.push(cell ? cell.v : '');
    }
    return columnData;
  }

  findRowIndexOfTicker(worksheet : XLSX.WorkSheet, columnIndex : number, range : XLSX.Range, ticker : string) : number {
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

  readCellValue(worksheet : XLSX.WorkSheet, columnIndex : number, rowIndex : number) : string {
    const cellAddress = { c: columnIndex, r: rowIndex };
    const cellRef = XLSX.utils.encode_cell(cellAddress);
    const cell = worksheet[cellRef];
    return cell ? cell.v : '';
  }

  async addCurrenciesToDatabase() {
    try{
      const euroBaseCurrency = await this.currenciesService.addCurrencyToDb("EUR" as string);
      for (const path of this.currenciesPath) {
        const worksheet = this.openExcelFile(path,undefined);
        const range = this.getExcelSize(worksheet);

        const dates = this.readExcelColumn(worksheet, 0, range)
          .map(date => this.dateService.transformExcelDateToDbDate(date));
        
        for (let i = 1; i <= range.e.c; i++) {
          const forexRates = this.readExcelColumn(worksheet, i, range);
          const quoteCurrency = await this.currenciesService.addCurrencyToDb(forexRates[0] as string);
          if (euroBaseCurrency && quoteCurrency) {
            const forex = await this.currenciesService.addForexToDb(euroBaseCurrency.uuid, quoteCurrency.uuid);
            this.addPriceCurrenciesFromExcel(dates, forexRates, forex,forexRates[0] as string);
          }
        }
      }
    }
    catch (error) {
      console.error("Error adding currencies to the database:", error);
    }
  }

  async addPriceCurrenciesFromExcel(dates : Date[], forexRates : string[], forex : Forex, quoteCurrencyName : string) {
    const latestUpdate = await this.currenciesService.getLastestForexRateFromDb(forex.uuid);
    const isMajor = this.majorCurrencies.includes(quoteCurrencyName);
    for (let j = 1; j < forexRates.length; j++) {
      if (dates[j] <= latestUpdate) {
        break;
      }
      const dayOfWeek = dates[j].getDay()
      if(!isMajor && dayOfWeek != 5)continue; // for non major currency, we only add the price of friday
      const forexRate = parseFloat(forexRates[j] as string);
      if(isNaN(forexRate)) {
        continue;
      }
      await this.currenciesService.addForexRateToDb(forex, dates[j], forexRate);
    }
  }

  getSectorFromTickerFromSpecificSheet(ticker : string, sheets : string[]) : string | null {
    try {
      for (const path of this.stocksPath) {
        for(const sheetName of sheets) {
          const worksheet = this.openExcelFile(path, sheetName);
          const range = this.getExcelSize(worksheet);
          const tickers = this.findRowIndexOfTicker(worksheet, this.tickersColumnIndex, range, ticker);
          if (tickers !== -1) {
            const sector = this.readCellValue(worksheet, this.sectorColumnIndex, tickers);
            if (sector) {
              return sector
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error(`Error fetching sectors for ticker ${ticker} from Excel:`, error);
      return null;
    }
  }

  async addAdminStocksToDatabase() {
    try {
      for(const ticker in this.defaultAssetTicker){
        const assetInfo = await this.marketstackService.fetchTickerInfo(ticker);
        const assetPrice = await this.marketstackService.fetchHistoricalData(ticker);
        const assetInfoPrice = assetPrice[0] as AssetPriceCompleteModel
        const currency = await this.currenciesService.getCurenciesFromDb(assetInfoPrice.price_currency);
        const asset = await this.assetService.addAssetFromAssetToDatabase(new AssetDatabaseModel(currency?.uuid ?? null,assetInfo.name,assetInfo.ticker,assetInfo.exchange_code,assetInfoPrice.asset_type))
        //Prix
        //Sector both avec allias et concentration svp
        //Pays
      }
    } catch (error) {
      console.error("Error adding stocks to the database:", error);
    }
  }
}
