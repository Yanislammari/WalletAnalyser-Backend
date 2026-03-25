import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";

export const attributesSector = {
  uuid: "uuid",
  sector_name: "sector_name",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class Sector extends Model {
  public uuid!: string;
  public sector_name!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Sector.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    sector_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        name: "unique_sector_constraint",
        msg: "Sector already exists in the database",
      },
    },
  },
  {
    sequelize,
  }
);
