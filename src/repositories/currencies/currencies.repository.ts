import { fn, col, Op } from "sequelize";
import { attributesCurrency, attributesForexRate, Currency, ForexRate } from "../../db_schema";
import { attributesForex, Forex } from "../../db_schema";
import { BaseRepository } from ".././base.repository";

export class CurrenciesRepository extends BaseRepository<Currency> {
  constructor() {
    super(Currency);
  }

  public async getByName(name: string): Promise<Currency | null> {
    return this.model.findOne({ where: { currency_name: name } });
  }

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

  async getAllCurrencies(): Promise<Currency[]> {
    try {
      return await Currency.findAll();
    } catch (error) {
      console.error("Error fetching all currencies from the database:", error);
      return [];
    }
  }

  async getOldestForexRateDatesByForexIds(forexUuids: string[]): Promise<Map<string, Date>> {
    try {
      if (forexUuids.length === 0) return new Map();

      const rows = await ForexRate.findAll({
        attributes: [
          [attributesForexRate.forex_uuid, "forex_uuid"],
          [fn("MIN", col(attributesForexRate.forex_rate_date)), "oldest_date"],
        ],
        where: {
          [attributesForexRate.forex_uuid]: { [Op.in]: forexUuids },
        },
        group: [attributesForexRate.forex_uuid],
        raw: true,
      }) as unknown as Array<{ forex_uuid: string; oldest_date: string }>;

      const result = new Map<string, Date>();
      for (const row of rows) {
        result.set(row.forex_uuid, new Date(row.oldest_date));
      }
      return result;
    } catch (error) {
      console.error("Error fetching oldest forex rate dates:", error);
      return new Map();
    }
  }

  async bulkCreateForexRates(
    records: Array<{ forex_uuid: string; forex_rate: number; forex_rate_date: Date }>
  ): Promise<void> {
    if (records.length === 0) return;
    await ForexRate.bulkCreate(records as any, { ignoreDuplicates: true });
  }

  async getClosestForexRateBeforeOrAt(
    baseCurrencyUuid: string,
    quoteCurrencyUuid: string,
    date: Date
  ): Promise<ForexRate | null> {
    try {
      const forex = await Forex.findOne({
        where: {
          [attributesForex.base_currency]: baseCurrencyUuid,
          [attributesForex.quote_currency]: quoteCurrencyUuid,
        },
      });
      if (!forex) return null;

      return await ForexRate.findOne({
        where: {
          [attributesForexRate.forex_uuid]: forex.uuid,
          [attributesForexRate.forex_rate_date]: { [Op.lte]: date },
        },
        order: [[attributesForexRate.forex_rate_date, "DESC"]],
      });
    } catch (error) {
      console.error("Error fetching closest forex rate before or at date:", error);
      return null;
    }
  }
}
