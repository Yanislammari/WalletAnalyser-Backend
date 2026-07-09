import { Op, QueryTypes } from "sequelize";
import { attributesCurrency, attributesForex, attributesForexRate, Currency, Forex, ForexRate } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { CurrenciesRepository } from "./currencies.repository";
import { sequelize } from "../../config";

interface DateAndLenght {
  latestDate : Date
  numberOfEntry : number 
}

export class ForexRepository extends BaseRepository<Forex> {
  private readonly currenciesRepository: CurrenciesRepository;
  private majorCurrencies: string[] = ["USD"]; //,"EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"];

  constructor() {
    super(Forex);
    this.currenciesRepository = new CurrenciesRepository();
  }

  async countAll(search: string): Promise<number> {
    const length = await Forex.count({
      include: [
        {
          association: "baseCurrency", // must match the alias used in your Forex.belongsTo(...) association
          attributes: [],
          required: false,
        },
        {
          association: "quoteCurrency",
          attributes: [],
          required: false,
        },
      ],
      where: search
        ? {
            [Op.or]: [
              { "$baseCurrency.currency_name$": { [Op.startsWith]: search } },
              { "$quoteCurrency.currency_name$": { [Op.startsWith]: search } },
            ],
          }
        : undefined,
      distinct: true,
      col: "uuid", // or whatever Forex's primary key column is, needed so distinct counts correctly
    });
    return length;
  }

  async addForexRatesFromExcel(dates: Date[], forexRates: string[], forex: Forex, quoteCurrencyName: string) : Promise<DateAndLenght> { // est un service mais c'est plus pratique de le mettre là pour éviter des import circulaires
    const latestForexRateUpdate = await this.currenciesRepository.getLatestForexRateFromDb(forex.uuid);
    let latestDate = new Date(0);
    let numberOfEntry = 0;
    if (latestForexRateUpdate) {
      latestDate = latestForexRateUpdate.forex_rate_date;
    }
    let messageDate = latestDate
    const isMajor = this.majorCurrencies.includes(quoteCurrencyName);
    for (let j = 1; j < forexRates.length; j++) {
      if (isNaN(dates[j].getTime())) continue;
      if (dates[j] <= latestDate) {
        //console.log("Stop running at index", j , "for currency", quoteCurrencyName, "date ", dates[j], " latest ", latestDate );
        break;
      }
      const dayOfWeek = dates[j].getDay();
      if (!isMajor && dayOfWeek != 5) continue; // for non major currency, we only add the price of friday
      const forexRate = parseFloat(forexRates[j] as string);
      if (isNaN(forexRate)) {
        continue;
      }
      messageDate = dates[j]
      numberOfEntry++;
      await this.currenciesRepository.addForexRateToDb(forex, dates[j], forexRate);
    }
    return {latestDate : messageDate, numberOfEntry}
  }

  async getAllForexUuid(offset: number, limit: number, search: string): Promise<Forex[]> {
    const forexes = await Forex.findAll({
      offset,
      limit,
      attributes: [attributesForex.uuid],
      include: [
        {
          model: Currency,
          as: "baseCurrency",
          attributes: [attributesCurrency.uuid, attributesCurrency.currency_name],
          required: true,
        },
        {
          model: Currency,
          as: "quoteCurrency",
          attributes: [attributesCurrency.uuid, attributesCurrency.currency_name],
          required: true,
        },
      ],
      where: search
        ? {
            [Op.or]: [
              { "$baseCurrency.currency_name$": { [Op.startsWith]: search } },
              { "$quoteCurrency.currency_name$": { [Op.startsWith]: search } },
            ],
          }
        : undefined,
      order: [
        [{ model: Currency, as: "baseCurrency" }, attributesCurrency.currency_name, "ASC"],
        [{ model: Currency, as: "quoteCurrency" }, attributesCurrency.currency_name, "ASC"],
      ],
    });
    return forexes
  }

  async getAllForex(): Promise<Forex[]> {
    return Forex.findAll({
      include: [
        {
          model: Currency,
          as: "baseCurrency",
          attributes: [attributesCurrency.currency_name]
        },
        {
          model: Currency,
          as: "quoteCurrency",
          attributes: [attributesCurrency.currency_name]
        },
      ],
    });
  }

  async getForexById(uuid: string): Promise<Forex | null> {
    return Forex.findOne({
      where : { [attributesForex.uuid] : uuid },
      attributes: [attributesForex.uuid],
      include: [
        {
          model: Currency,
          as: "baseCurrency",
          attributes: [attributesCurrency.uuid, attributesCurrency.currency_name],
        },
        {
          model: Currency,
          as: "quoteCurrency",
          attributes: [attributesCurrency.uuid, attributesCurrency.currency_name],
        },
      ],
      order: [
        [{ model: Currency, as: "baseCurrency" }, attributesCurrency.currency_name, "ASC"],
        [{ model: Currency, as: "quoteCurrency" }, attributesCurrency.currency_name, "ASC"],
      ],
    });
  }

  async getForexByCurrencies(baseCurrency: string, quoteCurrency: string): Promise<Forex | null> {
    const forex = await Forex.findOne({
      where: {
        [attributesForex.base_currency]: baseCurrency,
        [attributesForex.quote_currency]: quoteCurrency
      },
      include: [
        {
          model: Currency,
          as: "baseCurrency",
          attributes: [attributesCurrency.currency_name]
        },
        {
          model: Currency,
          as: "quoteCurrency",
          attributes: [attributesCurrency.currency_name]
        },
      ],
    });
    return forex;
  }

  async addForexToDb(baseCurrency: string, quoteCurrency: string): Promise<Forex> {
    const existingForex = await this.getForexByCurrencies(baseCurrency, quoteCurrency);
    if (existingForex) {
      return existingForex;
    }
    await Forex.create({
      [attributesForex.base_currency]: baseCurrency,
      [attributesForex.quote_currency]: quoteCurrency,
    });
    const getNew = await this.getForexByCurrencies(baseCurrency, quoteCurrency);
    return getNew!;
  }

  async updateForex(uuid: string, baseCurrency: string, quoteCurrency: string): Promise<Forex | null> {
    const forex = await this.update(uuid, {
      [attributesForex.base_currency]: baseCurrency,
      [attributesForex.quote_currency]: quoteCurrency,
    });
    if (!forex) return null;
    return forex;
  }

  async removeForex(uuid: string): Promise<boolean> {
    // First delete all forex rates
    await ForexRate.destroy({
      where: {
        [attributesForexRate.forex_uuid]: uuid,
      },
    });
    // Then delete the forex
    return await this.remove(uuid);
  }

  async getLatestForexRate(forexUuid: string): Promise<ForexRate | null> {
    const latestRate = await ForexRate.findOne({
      where: {
        [attributesForexRate.forex_uuid]: forexUuid,
      },
      order: [
        [attributesForexRate.forex_rate_date, "DESC"],
      ],
    });
    return latestRate;
  }

  async getLatestForexRateBulk(forexUuids: string[]): Promise<Map< string, Date | null >> {
    if (forexUuids.length === 0) return new Map();
    const rows = await sequelize.query<{ forex_uuid: string; forex_rate_date: Date | null }>(
      `
        SELECT DISTINCT ON (forex_uuid) forex_uuid, forex_rate_date
        FROM "ForexRates"
        WHERE forex_uuid IN (:forexUuids)
        ORDER BY forex_uuid, forex_rate_date DESC
      `,
      {
        replacements: { forexUuids },
        type: QueryTypes.SELECT,
      }
    );

    return new Map(rows.map((r) => [r.forex_uuid, r.forex_rate_date]));
  }

  async addForexRateToDb(forexUuid: string, date: Date, rate: number): Promise<ForexRate> {
    const existingRate = await ForexRate.findOne({
      where: {
        [attributesForexRate.forex_uuid]: forexUuid,
        [attributesForexRate.forex_rate_date]: date,
      },
    });
    if (existingRate) {
      return existingRate;
    }
    const forexRate = await ForexRate.create({
      [attributesForexRate.forex_uuid]: forexUuid,
      [attributesForexRate.forex_rate_date]: date,
      [attributesForexRate.forex_rate]: rate,
    });
    return forexRate;
  }
}