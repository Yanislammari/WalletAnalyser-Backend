import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Asset } from "./asset";

export const attributesAssetDividend = {
  uuid: "uuid",
  asset_uuid: "asset_uuid",
  dividend_amount: "dividend_amount",
  ex_date: "ex_date",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class AssetDividend extends Model {
  public uuid!: string;
  public asset_uuid!: string;
  public dividend_amount!: number;
  public ex_date!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AssetDividend.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    asset_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Asset,
        key: "uuid",
      },
    },
    dividend_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    ex_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

AssetDividend.belongsTo(Asset, { as: "asset", foreignKey: attributesAssetDividend.asset_uuid });
