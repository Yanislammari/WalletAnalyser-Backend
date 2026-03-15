import CurrenciesService from "./currencies.service";
import DateService from "./date.service";
import * as XLSX from 'xlsx';
import path from 'path';
import { Forex } from "../db_schema";

export default class ExcelService {

  private constantPath : string = "../asset/excel/"
  private defaultAssetTicker : string[] = ["MSFT", "TTE","UNH","BABA","NVDA","JPM","V","PG","TSM","CHT","RHHBF","T","HD","XOM","MRK","NVS","CMCSA","TM","BA","HSBC","NRG"] // a terme viendra d'une API officielle
  private currenciesPath : string[] = [path.join(__dirname,this.constantPath,'official_currencies_rate.xlsx')]
  private majorCurrencies : string[] = ["USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"];
  private risksFreeRatePath : string[] = ["..\src\excel\risk_free_rate_usa.xlsx"]
  private stocksPath : string[] = ["../asset/excel/official_stocks_api.xlsx"]
  private stocksSheetNameFr : string[] = ["usa_fr","europe_fr","world_ex_usa_fr"]
  private stocksSheetNameEn : string[] = ["usa_en","europe_en","world_ex_usa_en"]

  private currenciesService : CurrenciesService = new CurrenciesService()
  private dateService : DateService = new DateService();

  constructor() {

  }

  async addDataFromAdmin() {
    await this.addCurrenciesToDatabase();
  }

  openExcelFile(filePath : string) : XLSX.WorkSheet {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
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

  async addCurrenciesToDatabase() {
    try{
      const euroBaseCurrency = await this.currenciesService.addCurrencyToDb("EUR" as string);
      for (const path of this.currenciesPath) {
        const worksheet = this.openExcelFile(path);
        const range = this.getExcelSize(worksheet);

        const dates = this.readExcelColumn(worksheet, 0, range)
          .map(date => this.dateService.transformExcelDateToDbDate(date));
        
        for (let i = 1; i <= range.e.c; i++) {
          const forexRates = this.readExcelColumn(worksheet, i, range);
          const quoteCurrency = await this.currenciesService.addCurrencyToDb(forexRates[0] as string);
          if (euroBaseCurrency && quoteCurrency) {
            const forex = await this.currenciesService.addForexToDb(euroBaseCurrency.uuid, quoteCurrency.uuid);
            this.addPriceCurrenciesFromExcel(dates, forexRates, forex);
          }
        }
      }
    }
    catch (error) {
      console.error("Error adding currencies to the database:", error);
    }
  }

  async addPriceCurrenciesFromExcel(dates : Date[], forexRates : string[], forex : Forex) {
    const latestUpdate = await this.currenciesService.getLastestForexRateFromDb(forex.uuid);
    const isMajor = this.majorCurrencies.includes(forex.quote_currency);
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
}
