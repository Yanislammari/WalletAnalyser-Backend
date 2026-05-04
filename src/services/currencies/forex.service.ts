import { ForexRepository } from "../../repositories/currencies/forex.repository";
import { CurrenciesRepository } from "../../repositories/currencies.repository";
import { ForexMetaData, ForexPost } from "../../dtos/currencies/forex";
import XLSX from "xlsx";
import { ExcelService, DateService } from "../index";
import { attributesForex } from "../../db_schema";

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

  public async getAllForex(): Promise<ForexMetaData[]> {
    const forexList = await this.forexRepository.getAllForexUuid();
    const enriched: ForexMetaData[] = await Promise.all(
      forexList.map(async (forex) => ({
        forex,
        last_update: (await this.forexRepository.getLatestForexRate(forex.uuid))?.forex_rate_date ?? null
      }))
    );
    return enriched;
  }

  public async createForex(file: Express.Multer.File, baseCurrencyName: string, quoteCurrencyName: string): Promise<ForexPost> {
    // Ensure currencies exist
    const baseCurrency = await this.currenciesRepository.addCurrencyToDb(baseCurrencyName);
    const quoteCurrency = await this.currenciesRepository.addCurrencyToDb(quoteCurrencyName);

    const forex = await this.forexRepository.addForexToDb(baseCurrency.uuid, quoteCurrency.uuid);

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = this.excelService.getExcelSize(worksheet);
    const dates = this.excelService.readExcelColumn(worksheet, 0, range).map(date => this.dateService.transformExcelDateToDbDate(date));
    const rates = this.excelService.readExcelColumn(worksheet, 1, range);

    const seenDates = new Set();
    const latestRate = await this.forexRepository.getLatestForexRate(forex.uuid);
    let latestDate = new Date(0);
    if (latestRate) {
      latestDate = latestRate.forex_rate_date;
      seenDates.add(latestDate.toISOString().split('T')[0]);
    }

    let addToDb = 0;
    let latestInsertedDate: Date | null = null;

    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] <= latestDate) {
        break;
      }
      const parsedRate = parseFloat(rates[i]);
      const d = new Date(dates[i]);
      if (Number.isNaN(parsedRate)) continue;
      if (isNaN(d.getTime())) continue;

      const dateKey = d.toISOString().split('T')[0];
      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        if (!latestInsertedDate) {
          latestInsertedDate = d;
        }
        addToDb++;
        await this.forexRepository.addForexRateToDb(forex.uuid, d, parsedRate);
      }
    }

    return { forex: forex, last_update: latestInsertedDate, length: addToDb };
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