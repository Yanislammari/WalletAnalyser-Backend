import CurrenciesService from "./currencies.service";

export default class ExcelService {

  private defaultAssetTicker : string[] = ["MSFT", "TTE","UNH","BABA","NVDA","JPM","V","PG","TSM","CHT","RHHBF","T","HD","XOM","MRK","NVS","CMCSA","TM","BA","HSBC","NRG"] // a terme viendra d'une API officielle
  private currenciesPath : string[] = ["..\src\excel\official_currency_rate.xlsx"]
  private risksFreeRatePath : string[] = ["..\src\excel\risk_free_rate_usa.xlsx"]
  private stocksPath : string[] = ["..\src\excel\official_stocks_api.xlsx"]

  private currenciesService : CurrenciesService = new CurrenciesService()

  constructor() {

  }

  async addDataFromAdmin() {
    await this.addCurrenciesToDatabase();
  }



  async addCurrenciesToDatabase() {
    try{
      const euroBaseCurrency = await this.currenciesService.addCurrencyToDb("EUR" as string);
      for (const path of this.currenciesPath) {
        
      }
    }
    catch (error) {
      console.error("Error adding currencies to the database:", error);
    }
  }
}
