export interface AddAssetSellRequestDto {
  portfolioId: string;
  companyName?: string;
  assetPriceId?: string;
  sellCurrencyId: string;
  sellDate: string;
  assetSellAmount?: number;
  assetSellShare?: number;
  averageAssetShareBuyPrice?: number;
  assetSellGain?: number;
}
