import dotenv from 'dotenv';
import { AssetInfoModel, AssetPriceCompletModel, AssetPriceModel } from '../../models';

dotenv.config();
const apiKey = process.env.API_MARKETSTACK_KEY;
const baseUrl = process.env.API_MARKETSTACK_URL;

export default class MarketstackService {

  constructor() {

  }

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

  async fetchTickerInfo(ticker: string): Promise<AssetInfoModel> {
    try {
      const data = await this.fetchData(`tickerinfo?ticker=${ticker}&`);
      const tickerData = data.data;
      return new AssetInfoModel(tickerData.name, tickerData.ticker, tickerData.sector, tickerData.exchange_code);
    }
    catch (error) {
      console.error(`Error fetching ticker info for ${ticker}:`, error);
      throw error;
    }
  }

  async fetchHistoricalData(ticker: string): Promise<(AssetPriceCompletModel | AssetPriceModel)[]> {
    try {
      const data = await this.fetchData(`tickers/${ticker}/eod?limit=10000&`);
      const priceDate = data.data.eod
      return priceDate.map((item : any, index : number) => {
        if (index === 0) {
          return new AssetPriceCompletModel(
            new Date(item.date),
            item.adj_close,
            item.price_currency,
            item.asset_type
          );
        }

        return new AssetPriceModel(
          new Date(item.date),
          item.adj_close
        );
      });
    }
    catch (error) {
      console.error(`Error fetching historical data for ${ticker}:`, error);
      throw error;
    }
  }
}