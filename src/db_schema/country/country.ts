import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";

export const attributesCountry = {
  uuid: "uuid",
  country_name: "country_name",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class Country extends Model {
  public uuid!: string;
  public country_name!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Country.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    country_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        name: "unique_country_constraint",
        msg: "Country already exists in the database",
      },
    },
  },
  {
    sequelize,
  }
);