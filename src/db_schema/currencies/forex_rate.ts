import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Forex } from "..";

export const attributesForexRate = {
  uuid: "uuid",
  forex_uuid: "forex_uuid",
  forex_rate_date: "forex_rate_date",
  forex_rate: "forex_rate",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class ForexRate extends Model {
  public uuid!: string;
  public forex_uuid!: string;
  public forex_rate_date!: Date;
  public forex_rate!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ForexRate.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    forex_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Forex,
        key: "uuid",
      },
    },
    forex_rate_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    forex_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

ForexRate.belongsTo(Forex, { as: "forex", foreignKey: attributesForexRate.forex_uuid , onDelete: "CASCADE"});
