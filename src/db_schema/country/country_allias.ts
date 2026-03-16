import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config';
import { Country } from './country';

export const attributesCountryAllias = {
    uuid: 'uuid',
    country_uuid : 'country_uuid',
    country_allias_name : 'country_allias_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class CountryAllias extends Model {
    public uuid!: string;
    public country_uuid!: string;
    public country_allias_name!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

CountryAllias.init(
    {   
        uuid: {
            type: DataTypes.UUID,   
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        country_uuid: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
              model: Country,
              key: 'uuid'
          }
        },
        country_allias_name: {
          type: DataTypes.STRING,
          allowNull: false
        }
    },
    {
        sequelize,
    }
);

CountryAllias.belongsTo(Country, { as: 'alliasCountry', foreignKey: attributesCountryAllias.country_uuid });
