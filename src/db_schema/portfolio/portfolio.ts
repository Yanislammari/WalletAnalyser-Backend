import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { User } from "../users/users";
import { Currency } from "../currencies/currency";

export const attributesPortfolio = {
  uuid: "uuid",
  user_uuid: "user_uuid",
  display_currency_uuid: "display_currency_uuid",
  name: "name",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class Portfolio extends Model {
  public uuid!: string;
  public user_uuid!: string;
  public display_currency_uuid!: string | null;
  public name!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Portfolio.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    display_currency_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Currency,
        key: "uuid",
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

Portfolio.belongsTo(User, { as: "user", foreignKey: attributesPortfolio.user_uuid });
Portfolio.belongsTo(Currency, { as: "display_currency", foreignKey: attributesPortfolio.display_currency_uuid });
