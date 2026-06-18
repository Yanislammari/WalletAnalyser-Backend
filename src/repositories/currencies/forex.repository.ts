import { attributesCurrency, attributesForex, attributesForexRate, Currency, Forex, ForexRate } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { CurrenciesRepository } from "./currencies.repository";

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

  async getAllForexUuid(): Promise<Forex[]> {
    return Forex.findAll({
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