import { AssetRepository } from "../repositories/asset/asset.repository";
import { AssetPriceRepository } from "../repositories/asset/asset_price.repository";
import { AssetMapper } from "../mappers/asset.mapper";
import { AssetResponseDto } from "../dtos/asset/responses/asset.response.dto";
import { AssetPriceResponseDto } from "../dtos/asset/responses/asset.price.response.dto";
import { Asset } from "../db_schema/asset/asset";
import { AssetPrice } from "../db_schema/asset/asset_price";

export class AssetService {
  private readonly assetRepository: AssetRepository;
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly assetMapper: AssetMapper;

  constructor() {
    this.assetRepository = new AssetRepository();
    this.assetPriceRepository = new AssetPriceRepository();
    this.assetMapper = new AssetMapper();
  }

  public async getAllAssets(): Promise<AssetResponseDto[]> {
    const assets: Asset[] = await this.assetRepository.getAllAssets();
    return assets.map((asset) => this.assetMapper.assetEntityToDto(asset));
  }

  public async getAssetPrice(assetId: string, date: string): Promise<AssetPriceResponseDto | null> {
    const asset: Asset | null = await this.assetRepository.getAssetFromUUID(assetId);
    if (!asset) {
      throw new Error("ASSET_NOT_FOUND");
    }

    const targetDate: Date = new Date(date);
    let assetPrice: AssetPrice | null = await this.assetPriceRepository.getClosestPriceBeforeOrAt(assetId, targetDate);

    if (!assetPrice) {
      assetPrice = await this.assetPriceRepository.getLatestAssetPrice(assetId);
    }

    if (!assetPrice) {
      return null;
    }

    return {
      price: assetPrice.asset_price,
      date: assetPrice.asset_price_date.toISOString().split("T")[0],
    };
  }
}
