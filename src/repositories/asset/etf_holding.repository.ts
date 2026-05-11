import { Op } from "sequelize";
import { Asset, attributesAsset, attributesCountry, attributesSector, Country, EtfHoldingsAsset, Sector } from "../../db_schema";
import { attributesEtfHoldingsAsset } from "../../db_schema/asset/etf_holdings";
import { BaseRepository } from "../base.repository";
import { EtfAssetMetaData } from "../../dtos";

export class EtfHoldingsRepository extends BaseRepository<EtfHoldingsAsset> {
  constructor() {
    super(EtfHoldingsAsset)
  }

  async getEtfAssetsPaginated(etf_uuid: string, offset? : number, limit? : number, search? : string): Promise<EtfAssetMetaData> {
    const etfHoldings = await EtfHoldingsAsset.findAll({
      where: {
        [attributesEtfHoldingsAsset.etf_uuid]: etf_uuid,
        [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf] : {[Op.gte] : 0.01}
      },
      order : [
        [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf, "DESC"],
      ],
      limit : limit,
      offset : offset,
      attributes : [attributesEtfHoldingsAsset.uuid, attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf],
      include: [{
        model: Asset,
        as: "asset",
        where: {
          [attributesAsset.official_name]: {
            [Op.iLike]: `${search}%`
          }
        },
        required: true,
        attributes : [attributesAsset.uuid, attributesAsset.official_name],
        include : [
          {
            model : Sector,
            as : "sector",
            attributes : [ attributesSector.uuid, attributesSector.sector_name]
          },
          {
            model : Country,
            as : "country",
            attributes : [ attributesCountry.uuid, attributesCountry.country_name]
          }
        ]
      }]
    });
    const length = (await EtfHoldingsAsset.findAll({
      where: {
        [attributesEtfHoldingsAsset.etf_uuid]: etf_uuid,
        [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf] : {[Op.gte] : 0.01}
      },
      attributes : [attributesEtfHoldingsAsset.uuid, attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf],
      include: [{
        model: Asset,
        as: "asset",
        where: {
          [attributesAsset.official_name]: {
            [Op.iLike]: `${search}%`
          }
        },
        required: true,
      }]
    })).length;
    return { etf_asset : etfHoldings, length};
  }

  async getEtfHoldingsFromEtf(etf_uuid: string): Promise<EtfHoldingsAsset[]> {
    const etfHoldings = await EtfHoldingsAsset.findAll({
      where: {
        [attributesEtfHoldingsAsset.etf_uuid]: etf_uuid,
        [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf] : {[Op.gte] : 0.01}
      },
      order : [
        [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf, "DESC"],
      ],
      attributes : [attributesEtfHoldingsAsset.uuid, attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf],
      include: [{
        model: Asset,
        as: "asset",
        required: true,
        attributes : [attributesAsset.uuid, attributesAsset.official_name],
        include : [
          {
            model : Sector,
            as : "sector",
            attributes : [ attributesSector.uuid, attributesSector.sector_name]
          },
          {
            model : Country,
            as : "country",
            attributes : [ attributesCountry.uuid, attributesCountry.country_name]
          }
        ]
      }]
    });
    return etfHoldings;
  }

  async getHoldingDetailled(uuid: string): Promise<EtfHoldingsAsset | null> {
    const etfHoldings = await EtfHoldingsAsset.findOne({
      where: { [attributesEtfHoldingsAsset.uuid]: uuid },
      order : [[attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf, "DESC"]],
      attributes : [attributesEtfHoldingsAsset.uuid, attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf],
      include: [{
        model: Asset,
        as: "asset",
        required: true,
        attributes : [attributesAsset.uuid, attributesAsset.official_name],
        include : [
          {
            model : Sector,
            as : "sector",
            attributes : [ attributesSector.uuid, attributesSector.sector_name]
          },
          {
            model : Country,
            as : "country",
            attributes : [ attributesCountry.uuid, attributesCountry.country_name]
          }
        ]
      }]
    });
    return etfHoldings;
  }

  async getEtfHoldings(asset_uuid: string, etf_uuid: string): Promise<EtfHoldingsAsset | null> {
    const etfHoldings = await EtfHoldingsAsset.findOne({
      where: {
        [attributesEtfHoldingsAsset.asset_uuid]: asset_uuid,
        [attributesEtfHoldingsAsset.etf_uuid]: etf_uuid,
      },
    });
    return etfHoldings;
  }

  async createEtfHoldings(etf_uuid: string, asset_uuid: string, asset_percentage_concentration_in_etf: number): Promise<EtfHoldingsAsset> {
    try {
      const existingEtfHoldings = await this.getEtfHoldings(asset_uuid, etf_uuid);
      if (existingEtfHoldings) {
        return existingEtfHoldings;
      }
      const newEtfHoldings = await EtfHoldingsAsset.create({
        [attributesEtfHoldingsAsset.etf_uuid]: etf_uuid,
        [attributesEtfHoldingsAsset.asset_uuid]: asset_uuid,
        [attributesEtfHoldingsAsset.asset_percentage_concentration_in_etf]: asset_percentage_concentration_in_etf,
      });
      return newEtfHoldings;
    } catch (error) {
      console.error(`Error creating ETF holdings for asset_uuid: ${asset_uuid} and etf_uuid: ${etf_uuid}`, error);
      throw error;
    }
  }

  async deleteAllHoldingsOfAnEtf(etf_uuid : string) {
    await EtfHoldingsAsset.destroy({
      where : { [attributesEtfHoldingsAsset.etf_uuid] : etf_uuid }
    })
  }
}
