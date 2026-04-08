import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Asset } from "..";
import { tr } from "zod/locales";

export const attributesEtfHoldingsAsset = {
  uuid: "uuid",
  etf_uuid: "etf_uuid",
  asset_uuid: "asset_uuid",
  asset_percentatge_concentration_in_etf: "asset_percentatge_concentration_in_etf",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class EtfHoldingsAsset extends Model {
  public uuid!: string;
  public etf_uuid!: string;
  public asset_uuid!: string;
  public asset_percentatge_concentration_in_etf!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EtfHoldingsAsset.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    etf_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Asset,
        key: "uuid",
      },
    },
    asset_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Asset,
        key: "uuid",
      },
    },
    asset_percentatge_concentration_in_etf: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

EtfHoldingsAsset.belongsTo(Asset, { as: "etf", foreignKey: attributesEtfHoldingsAsset.etf_uuid });
EtfHoldingsAsset.belongsTo(Asset, { as: "asset", foreignKey: attributesEtfHoldingsAsset.asset_uuid });
