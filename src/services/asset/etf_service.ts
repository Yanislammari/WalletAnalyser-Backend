import { AssetRepository } from "./../../repositories/asset/asset.repository";
import { EtfMetaData, SectorConcentrationEtf, CountryConcentrationEtf } from "../../dtos";
import { AssetPriceRepository } from "../../repositories";
import { EtfHoldingsRepository } from '../../repositories/asset/etf_holding.repository';

export class EtfService {
  private readonly etfHoldingsRepository : EtfHoldingsRepository;

  constructor() {
    this.etfHoldingsRepository = new EtfHoldingsRepository();
  }

  public async getConcentrationETF(etf_uuid : string): Promise<EtfMetaData> {
    const assetsInEtf = await this.etfHoldingsRepository.getEtfHoldingsFromEtf(etf_uuid);
    const sectorConcentration = new Map()
    const countryConcentration = new Map()

    for (let i = 0; i < assetsInEtf.length; i++) {
      const sectorKey = assetsInEtf[i].asset.sector?.uuid + "||" + assetsInEtf[i].asset.sector?.sector_name
      const countryKey = assetsInEtf[i].asset.country?.uuid + "||" + assetsInEtf[i].asset.country?.country_name

      if(sectorKey != undefined) {
        sectorConcentration.set(
          sectorKey,
          (sectorConcentration.get(sectorKey) ?? 0) + assetsInEtf[i].asset_percentage_concentration_in_etf
        )
      }

      if(countryKey != undefined) {
        countryConcentration.set(
          countryKey,
          (countryConcentration.get(countryKey) ?? 0) + assetsInEtf[i].asset_percentage_concentration_in_etf
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
    return { etf_asset : assetsInEtf, sector_concentrations : sectorToETFFormat, country_concentrations : countryToETFFormat}
  }
}
