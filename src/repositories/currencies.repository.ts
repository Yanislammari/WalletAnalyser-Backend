import { attributesCurrency, attributesForexRate, Currency, ForexRate } from "../db_schema";
import { attributesForex, Forex } from "../db_schema";

export class CurrenciesRepository {
  constructor() {}

  async getForexFromDb(baseCurrency: string, quoteCurrency: string): Promise<Forex | null> {
    try {
      const existingForex =
        (await Forex.findOne({
          where: {
            [attributesForex.base_currency]: baseCurrency,
            [attributesForex.quote_currency]: quoteCurrency,
          },
        })) || null;
      return existingForex;
    } catch (error) {
      console.error("Error fetching forex from the database:", error);
      return null;
    }
  }

  async getCurenciesFromDb(currencyName: string): Promise<Currency | null> {
    try {
      const existingCurrency =
        (await Currency.findOne({
          where: {
            [attributesCurrency.currency_name]: currencyName,
          },
        })) || null;
      return existingCurrency;
    } catch (error) {
      console.error("Error fetching currencies from the database:", error);
      return null;
    }
  }

  async getLatestForexRateFromDb(forexUuid: string): Promise<ForexRate | null> {
    try {
      const latestPrice = await ForexRate.findOne({
        where: {
          [attributesForexRate.forex_uuid]: forexUuid,
        },
        order: [
          [attributesForexRate.forex_rate_date, "DESC"], // newest first
        ],
      });
      return latestPrice;
    } catch (error) {
      console.error("Error fetching the latest forex exchange price from the database:", error);
      throw error;
    }
  }

  async addCurrencyToDb(currencyName: string): Promise<Currency> {
    try {
      const existingCurrency = await this.getCurenciesFromDb(currencyName);
      if (existingCurrency) {
        return existingCurrency;
      }
      const currency = Currency.create({
        [attributesCurrency.currency_name]: currencyName,
      });
      return currency;
    } catch (error) {
      console.error(`Error adding currency ${currencyName} to the database:`, error);
      throw error;
    }
  }

  async addForexToDb(baseCurrency: string, quoteCurrency: string): Promise<Forex> {
    try {
      const existingForex = await this.getForexFromDb(baseCurrency, quoteCurrency);
      if (existingForex) {
        return existingForex;
      }
      const forex = Forex.create({
        [attributesForex.base_currency]: baseCurrency,
        [attributesForex.quote_currency]: quoteCurrency,
      });
      return forex;
    } catch (error) {
      console.error(`Error adding forex ${baseCurrency}/${quoteCurrency} to the database:`, error);
      throw error;
    }
  }

  async getForexRateFromDb(forex: Forex, forexRateDate: Date): Promise<ForexRate | null> {
    try {
      const existingForexRate = await ForexRate.findOne({
        where: {
          [attributesForexRate.forex_uuid]: forex.uuid,
          [attributesForexRate.forex_rate_date]: forexRateDate,
        },
      });
      return existingForexRate;
    } catch (error) {
      console.error("Error fetching forex exchange price from the database:", error);
      throw error;
    }
  }

  async addForexRateToDb(forex: Forex, date: Date, rate: number): Promise<ForexRate> {
    try {
      const existingForexRate = await this.getForexRateFromDb(forex, date);
      if (existingForexRate) {
        return existingForexRate;
      }
      const forexRate = ForexRate.create({
        [attributesForexRate.forex_uuid]: forex.uuid,
        [attributesForexRate.forex_rate_date]: date,
        [attributesForexRate.forex_rate]: rate,
      });
      return forexRate;
    } catch (error) {
      console.error(`Error adding forex exchange price for ${forex.base_currency}/${forex.quote_currency} to the database:`, error);
      throw error;
    }
  }
}
