export interface UpdateAssetBuyRequestDto {
  buyCurrencyId: string;
  buyDate: string;
  assetBuyAmount?: number;
  assetBuyShare?: number;
  assetBuyPricePerShare?: number;
}
