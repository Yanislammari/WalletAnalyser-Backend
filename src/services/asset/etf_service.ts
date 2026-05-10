import { attributesEtfHoldingsAsset, EtfHoldingsAsset } from "../../db_schema";
import { SectorConcentrationEtf, CountryConcentrationEtf, EtfAssetMetaData, EtfconcentrationMetaData, EtfPatchAssetPayload } from "../../dtos";
import { AssetDatabaseModel } from "../../models";
import { AssetRepository } from "../../repositories";
import { EtfHoldingsRepository } from '../../repositories/asset/etf_holding.repository';

export class EtfService {
  private readonly etfHoldingsRepository : EtfHoldingsRepository;
  private readonly assetRepository : AssetRepository;

  constructor() {
    this.etfHoldingsRepository = new EtfHoldingsRepository();
    this.assetRepository = new AssetRepository();
  }

  public async getEtfPaginated(etf_uuid: string, offset? : number, limit? : number, search? : string) : Promise<EtfAssetMetaData> {
    const assetsMetaData = await this.etfHoldingsRepository.getEtfAssetsPaginated(etf_uuid, offset, limit, search)
    return assetsMetaData
  }

  public async getConcentrationETF(etf_uuid : string): Promise<EtfconcentrationMetaData> {
    const asset = await this.assetRepository.getById(etf_uuid)
    if(!asset){
      throw new Error("NO_ASSET")
    }
    const assetsInEtf = await this.etfHoldingsRepository.getEtfHoldingsFromEtf(etf_uuid);
    const sectorConcentration = new Map()
    const countryConcentration = new Map()

    for (let i = 0; i < assetsInEtf.length; i++) {
      const sector = assetsInEtf[i].asset.sector
      const country = assetsInEtf[i].asset.country

      if (sector?.uuid && sector?.sector_name) {
        const sectorKey = `${sector.uuid}||${sector.sector_name}`

        sectorConcentration.set(
          sectorKey,
          (sectorConcentration.get(sectorKey) ?? 0) +
          assetsInEtf[i].asset_percentage_concentration_in_etf
        )
      }

      if (country?.uuid && country?.country_name) {
        const countryKey = `${country.uuid}||${country.country_name}`

        countryConcentration.set(
          countryKey,
          (countryConcentration.get(countryKey) ?? 0) +
          assetsInEtf[i].asset_percentage_concentration_in_etf
        )
      }
    }

    const sectorToETFFormat: SectorConcentrationEtf[] = Array.from(sectorConcentration.entries()).map(([key, value]) => {
      const uuid = key.split("||")[0]
      const name = key.split("||")[1]
      return { sector_uuid: uuid, sector_name : name, percentage_in_sector: value }
    })
  
    const countryToETFFormat : CountryConcentrationEtf[] = Array.from(countryConcentration.entries()).map(([key, value]) => {
      const uuid = key.split("||")[0]
      const name = key.split("||")[1]
      return { country_uuid: uuid, country_name : name, percentage_in_country: value }  
    })
    
    sectorToETFFormat.sort((a,b)=>{
      return b.percentage_in_sector - a.percentage_in_sector
    })
    countryToETFFormat.sort((a , b) =>{
      return b.percentage_in_country - a.percentage_in_country
    })
    const limitAsset = assetsInEtf.slice(0,25)

    return { etf : asset , etf_asset : limitAsset, sector_concentrations : sectorToETFFormat, country_concentrations : countryToETFFormat, length : assetsInEtf.length}
  }

  public async updateEtfHolding( payload : EtfPatchAssetPayload, etf_uuid : string ): Promise<EtfHoldingsAsset | null> {
    const holding = await this.etfHoldingsRepository.getEtfHoldings(payload.asset_uuid, etf_uuid)
    console.log(etf_uuid, payload.asset_uuid)
    if(!holding) {
      throw new Error("NO_ASSET")
    }

    const metaData = await this.getConcentrationETF(etf_uuid)
    const totalSectorPercentage = metaData.sector_concentrations.reduce(
      (sum, sector) => sum + sector.percentage_in_sector,
      0
    );
    const totalCountryPercentage = metaData.country_concentrations.reduce(
      (sum, country) => sum + country.percentage_in_country,
      0
    );

    if(totalCountryPercentage - holding.asset_percentage_concentration_in_etf + payload.asset_percentage_concentration_in_etf > 100) {
      throw new Error("ABOVE_100")
    }

    if(totalSectorPercentage - holding.asset_percentage_concentration_in_etf + payload.asset_percentage_concentration_in_etf > 100) {
      throw new Error("ABOVE_100")
    }

    const etfPatch = await this.etfHoldingsRepository.update(holding.uuid, {
      [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf] : payload.asset_percentage_concentration_in_etf
    })

    if(!etfPatch) {
      throw new Error("NO_ASSET")
    }

    const asset = await this.assetRepository.getById(payload.asset_uuid)
    if(!asset) {
      throw new Error("NO_ASSET")
    }

    const assetDb = new AssetDatabaseModel(
      asset.official_name,
      asset.ticker_name,
      asset.asset_type,
      payload.sector_uuid,
      payload.country_uuid,
      asset.base_currency_uuid
    );
    await this.assetRepository.patchAssetInfo(asset.uuid, assetDb)

    const holdingFull = await this.etfHoldingsRepository.getHoldingDetailled(holding.uuid)
    
    return holdingFull
  }
}
