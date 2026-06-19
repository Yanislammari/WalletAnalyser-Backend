import { ForexRepository } from "../../repositories/currencies/forex.repository";
import { CurrenciesRepository } from "../../repositories/currencies/currencies.repository";
import { ForexListMessage, ForexListMetaData, ForexMetaData } from "../../dtos/currencies/forex";
import * as XLSX from "xlsx";
import { ExcelService, DateService } from "../index";
import { attributesForex, Currency, Forex } from "../../db_schema";
import { Op } from "sequelize";

export class ForexService {
  private readonly forexRepository: ForexRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly excelService: ExcelService;
  private readonly dateService: DateService;

  constructor() {
    this.forexRepository = new ForexRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.excelService = new ExcelService();
    this.dateService = new DateService();
  }

  public async getAllForex(offset = 0, limit = 100, search?: string): Promise<ForexListMetaData> {
    const forexList = await this.forexRepository.getAllForexUuid(offset, limit, search ?? "");
    const enriched: ForexMetaData[] = await Promise.all(
      forexList.map(async (forex) => ({
        forex,
        last_update: (await this.forexRepository.getLatestForexRate(forex.uuid))?.forex_rate_date ?? null
      }))
    );
    const length = (await this.forexRepository.get({
      where: search
        ? {
            [Op.or]: [
              { "$baseCurrency.currency_name$": { [Op.startsWith]: search } }, // va chercher le nom dans la clé étrangère
              { "$quoteCurrency.currency_name$": { [Op.startsWith]: search } },
            ],
          }
        : undefined,
      include: [
        {
          model: Currency,
          as: "baseCurrency",
          attributes: [],
          required: false,
        },
        {
          model: Currency,
          as: "quoteCurrency",
          attributes: [],
          required: false,
        },
      ],
    })).length;
    return {length , forex_list : enriched};
  }

  public async createForex(file: Express.Multer.File, baseCurrencyUuid: string): Promise<ForexListMessage> {
    const baseCurrency = await this.currenciesRepository.getById(baseCurrencyUuid);

    const workbook = XLSX.read(file?.buffer, {
      type: "buffer",
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = this.excelService.getExcelSize(worksheet);
    const dates = this.excelService.readExcelColumn(worksheet, 0, range).map(date => this.dateService.transformExcelDateToDbDate(date));

    let messages = ""
    const metaData : ForexMetaData[] = []
    /**if(range.e.c == 0){
      throw Error("WRONG_FORMAT")
    }**/
    for (let i = 1; i <= range.e.c; i++) {
      const forexRates = this.excelService.readExcelColumn(worksheet, i, range);
      const quoteCurrency = await this.currenciesRepository.addCurrencyToDb(forexRates[0] as string);
      if (baseCurrency && quoteCurrency) {
        const exist = await this.forexRepository.get({where : { [attributesForex.base_currency] : baseCurrency.uuid, [attributesForex.quote_currency] : quoteCurrency.uuid }})
        const forex = await this.currenciesRepository.addForexToDb(baseCurrency.uuid, quoteCurrency.uuid);
        const forexComplete = await this.forexRepository.getForexById(forex.uuid)
        if(!forexComplete){
          throw Error("NO_FOREX")
        }
        const dateAndNumberOfEntry = await this.forexRepository.addForexRatesFromExcel(dates, forexRates, forex, forexRates[0] as string);
        metaData.push({forex : forexComplete , last_update : dateAndNumberOfEntry.latestDate})
        if(exist){
          messages += `Forex ${baseCurrency.currency_name}/${quoteCurrency.currency_name} modified, adding ${dateAndNumberOfEntry.numberOfEntry}\n`
        } else {
          messages += `New forex ${baseCurrency.currency_name}/${quoteCurrency.currency_name} modified, adding ${dateAndNumberOfEntry.numberOfEntry}\n`
        }
      }
    }

    return {forex_list : metaData, message : messages};
  }

  public async updateForex(uuid: string, newBaseCurrencyId: string, newQuoteCurrencyId: string) : Promise<ForexMetaData | null> {
    const exist = await this.forexRepository.get({ 
      where : {
        [attributesForex.base_currency] : newBaseCurrencyId,
        [attributesForex.quote_currency] : newQuoteCurrencyId,
      }
    })
    if(exist.length != 0){
      throw Error("ALREADY_FOREX")  
    }
    const newBaseCurrency = await this.currenciesRepository.getById(newBaseCurrencyId);
    const newQuoteCurrency = await this.currenciesRepository.getById(newQuoteCurrencyId);

    if( !newBaseCurrency || !newQuoteCurrency){
      return null
    }

    const forex = await this.forexRepository.updateForex(uuid, newBaseCurrency.uuid, newQuoteCurrency.uuid);
    if (!forex) return null;
    const forexMeta = await this.forexRepository.getForexById(forex.uuid)
    if(!forexMeta) return null
    const last_update = (await this.forexRepository.getLatestForexRate(forex.uuid))?.forex_rate_date ?? null
    return {forex : forexMeta, last_update : last_update};
  }

  public async deleteForex(uuid: string): Promise<boolean> {
    return await this.forexRepository.removeForex(uuid);
  }
}