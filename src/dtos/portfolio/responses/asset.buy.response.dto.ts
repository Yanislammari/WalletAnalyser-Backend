export interface AssetBuyResponseDto {
  id: string;
  portfolioId: string;
  companyName: string | null;
  assetId: string | null;
  buyCurrencyId: string;
  buyDate: string;
  assetBuyAmount: number | null;
  assetBuyShare: number | null;
  assetBuyPricePerShare: number | null;
  createdAt: Date;
  updatedAt: Date;
}
