import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Currency } from "../currencies/currency";
import { Sector } from "../sector/sector";
import { Country } from "../country/country";

export const attributesAsset = {
  uuid: "uuid",
  base_currency_uuid: "base_currency_uuid",
  asset_type: "asset_type",
  ticker_name: "ticker_name",
  official_name: "official_name",
  sector_uuid: "sector_uuid",
  country_uuid: "country_uuid",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class Asset extends Model {
  public uuid!: string;
  public base_currency_uuid!: string;
  public asset_type!: string;
  public ticker_name!: string;
  public official_name!: string;
  public sector_uuid!: string;
  public country_uuid!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Asset.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    base_currency_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Currency,
        key: "uuid",
      },
    },
    asset_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ticker_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    official_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sector_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Sector,
        key: "uuid",
      },
    },
    country_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Country,
        key: "uuid",
      },
    },
  },
  {
    sequelize,
  }
);

Asset.belongsTo(Currency, { as: "base_currency", foreignKey: attributesAsset.base_currency_uuid });
Asset.belongsTo(Sector, { as: "sector", foreignKey: attributesAsset.sector_uuid });
Asset.belongsTo(Country, { as: "country", foreignKey: attributesAsset.country_uuid });
