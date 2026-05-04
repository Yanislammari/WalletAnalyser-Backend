import { Op } from "sequelize";
import { attributesCurrency, Currency } from "../../db_schema";
import { BaseRepository } from "../base.repository";

export class CurrenciesRepository extends BaseRepository<Currency> {
  constructor() {
    super(Currency);
  }

  async getCurrencyByName(currencyName: string): Promise<Currency | null> {
    try {
      const currency = await Currency.findOne({
        where: {
          [attributesCurrency.currency_name]: {
            [Op.iLike]: currencyName, // PostgreSQL case-insensitive LIKE
          },
        },
      });
      return currency;
    } catch (error) {
      console.error(`Error fetching ${currencyName}`, error);
      return null;
    }
  }

  async getAllCurrencies(): Promise<Currency[]> {
    try {
      const currencies = await Currency.findAll();
      return currencies;
    } catch (error) {
      console.error(`Error fetching all currencies`, error);
      return [];
    }
  }

  async addCurrencyToDatabase(currency: string): Promise<Currency> {
    try {
      const existingCurrency = await this.getCurrencyByName(currency);
      if (existingCurrency) {
        return existingCurrency;
      }
      const newCurrency = await Currency.create({
        [attributesCurrency.currency_name]: currency,
      });
      return newCurrency;
    } catch (error) {
      console.error(`Error adding currency ${currency} to database:`, error);
      throw error;
    }
  }
}