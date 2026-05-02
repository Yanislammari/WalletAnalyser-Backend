import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Portfolio } from "./portfolio";
import { Currency } from "../currencies/currency";

export const attributesUserAssetDividend = {
  uuid: "uuid",
  portfolio_uuid: "portfolio_uuid",
  currency_uuid: "currency_uuid",
  cashflow_date: "cashflow_date",
  cashflow_amount: "cashflow_amount",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class UserAssetDividend extends Model {
  public uuid!: string;
  public portfolio_uuid!: string;
  public currency_uuid!: string;
  public cashflow_date!: Date;
  public cashflow_amount!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserAssetDividend.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    portfolio_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Portfolio,
        key: "uuid",
      },
    },
    currency_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Currency,
        key: "uuid",
      },
    },
    cashflow_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    cashflow_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

UserAssetDividend.belongsTo(Portfolio, { as: "portfolio", foreignKey: attributesUserAssetDividend.portfolio_uuid });
UserAssetDividend.belongsTo(Currency, { as: "currency", foreignKey: attributesUserAssetDividend.currency_uuid });
