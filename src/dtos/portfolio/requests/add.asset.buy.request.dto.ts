export interface AddAssetBuyRequestDto {
  portfolioId: string;
  companyName?: string;
  assetPriceId?: string;
  buyCurrencyId: string;
  buyDate: string;
  assetBuyAmount?: number;
  assetBuyShare?: number;
  assetBuyPricePerShare?: number;
}
