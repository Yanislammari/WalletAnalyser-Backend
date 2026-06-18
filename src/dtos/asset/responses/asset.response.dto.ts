export interface AssetResponseDto {
  id: string;
  baseCurrencyId: string | null;
  assetType: string | null;
  tickerName: string | null;
  officialName: string | null;
  sectorId: string | null;
  countryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
