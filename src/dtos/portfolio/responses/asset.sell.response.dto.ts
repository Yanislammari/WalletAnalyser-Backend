export interface AssetSellResponseDto {
  id: string;
  portfolioId: string;
  companyName: string | null;
  assetPriceId: string | null;
  sellCurrencyId: string;
  sellDate: string;
  assetSellAmount: number | null;
  assetSellShare: number | null;
  averageAssetShareBuyPrice: number | null;
  assetSellGain: number | null;
  createdAt: Date;
  updatedAt: Date;
}
