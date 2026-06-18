import { Asset } from "../db_schema/asset/asset";
import { AssetResponseDto } from "../dtos/asset/responses/asset.response.dto";

export class AssetMapper {
  public assetEntityToDto(entity: Asset): AssetResponseDto {
    return {
      id: entity.uuid,
      baseCurrencyId: entity.base_currency_uuid ?? null,
      assetType: entity.asset_type ?? null,
      tickerName: entity.ticker_name ?? null,
      officialName: entity.official_name ?? null,
      sectorId: entity.sector_uuid ?? null,
      countryId: entity.country_uuid ?? null,
      createdAt: entity.dataValues.created_at,
      updatedAt: entity.dataValues.updated_at,
    };
  }
}
