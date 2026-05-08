import dotenv from "dotenv";
import { AssetPriceCompletModel, AssetPriceModel } from "../../models";
import { AssetType, CompanyTickerDto, TickerInfoDto } from "../../dtos";

dotenv.config();
const apiKey = process.env.API_MARKETSTACK_KEY;
const baseUrl = process.env.API_MARKETSTACK_URL;

export class MarketstackController {
  constructor() {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async fetchData(endpoint: string): Promise<any> {
    const url = new URL(`${baseUrl}${endpoint}access_key=${apiKey}`);
    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching data from Marketstack API:`, error);
      throw error;
    }
  }

  async fetchTickerInfo(ticker: string): Promise<TickerInfoDto> {
    try {
      const data = await this.fetchData(`tickerinfo?ticker=${ticker}&`);
      return data.data as TickerInfoDto;
    } catch (error) {
      console.error(`Error fetching ticker info for ${ticker}:`, error);
      throw error;
    }
  }

  async fetchHistoricalData(ticker: string): Promise<(AssetPriceCompletModel | AssetPriceModel)[]> {
    try {
      const data = await this.fetchData(`tickers/${ticker}/eod?limit=10000&`);
      const priceDate = data.data.eod;
      const name = data.data.name;
      const symbol = data.data.symbol;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return priceDate.map((item: any, index: number) => {
        if (index === 0) {
          const asset_type = item.asset_type ?? AssetType.STOCKS;
          const price_currency = item.price_currency ?? "USD";
          return new AssetPriceCompletModel(new Date(item.date), item.adj_close, price_currency, asset_type, symbol, name);
        }

        return new AssetPriceModel(new Date(item.date), item.adj_close);
      });
    } catch (error : any) {
      if(error.message.includes("404")) {
        throw Error("UNFOUND_TICKER")
      }
      throw error;
    }
  }

  async fetchTickers(): Promise<CompanyTickerDto[]> {
    try {
      const data = await this.fetchData(`tickerslist?limit=2500&`);
      return data.data as CompanyTickerDto[];
    } catch (error) {
      console.error(`Error fetching all tickers :`, error);
      throw error;
    }
  }
}
