import { attributesCurrency, Currency } from '../db_schema';

export default class CurrenciesService {

  constructor() {

  }

  async getCurenciesFromDb(currencyName : string) : Promise<Currency | null> {
    try {
      const existingCurrency = await Currency.findOne({
        where: {
          [attributesCurrency.currencyName]: currencyName
        }
      }) || null;
      return existingCurrency;
    }
    catch (error) {
      console.error("Error fetching currencies from the database:", error);
      return null;
    }
  }

  async addCurrencyToDb(currencyName : string) : Promise<Currency | void> {
    try {
      const existingCurrency = await this.getCurenciesFromDb(currencyName);
      if (existingCurrency) {
        return existingCurrency;
      }
      const currency = Currency.create({
        [attributesCurrency.currencyName]: currencyName
      });
      return currency;
    }
    catch (error) {
      console.error(`Error adding currency ${currencyName} to the database:`, error);
    }
  }

  async addForexToDb() {

  }

  async addForexExchangePricesToDb() {
    
  }

}
