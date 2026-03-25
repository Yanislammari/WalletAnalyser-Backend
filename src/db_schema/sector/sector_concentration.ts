import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Asset } from "..";
import { Sector } from "./sector";

export const attributesSectorConcentration = {
  uuid: "uuid",
  sector_uuid: "sector_uuid",
  asset_uuid: "asset_uuid",
  sector_concentration_percentage: "sector_concentration_percentage",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class SectorConcentration extends Model {
  public uuid!: string;
  public sector_uuid!: string;
  public asset_uuid!: string;
  public sector_concentration_percentage!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SectorConcentration.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    sector_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Sector,
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
    sector_concentration_percentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    sequelize,
  }
);

SectorConcentration.belongsTo(Sector, { as: "sector", foreignKey: attributesSectorConcentration.sector_uuid });
SectorConcentration.belongsTo(Asset, { as: "asset", foreignKey: attributesSectorConcentration.asset_uuid });
